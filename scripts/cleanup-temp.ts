/**
 * Maintenance cleanup:
 * 1. Delete files in TEMP_DIR older than TEMP_FILE_MAX_AGE_HOURS (default 24).
 * 2. Delete unreferenced S3 objects under temp prefixes, and orphaned uploads.
 * 3. Archive audit_logs older than AUDIT_LOG_RETENTION_DAYS (default 90) to S3,
 *    then delete the archived rows.
 *
 * Expected tables:
 *   media_objects(storage_key text)
 *   audit_logs(id, action text, metadata jsonb, created_at timestamptz)
 *
 * If media_objects is empty, upload orphans are left in place unless
 * CLEANUP_ALLOW_EMPTY_MEDIA_INDEX=true. Temp prefixes are still removed.
 *
 * Schedule (UTC):
 *   30 3 * * * npx tsx scripts/cleanup-temp.ts
 */
import { createWriteStream } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { finished } from "node:stream/promises";
import { gzipSync } from "node:zlib";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, type _Object } from "@aws-sdk/client-s3";
import type { QueryResult } from "pg";
import { writeAuditEvent } from "../src/lib/audit";
import { encryptBuffer, requireEncryptionKey } from "../src/lib/encrypted-blob";
import { createPgPool, databaseUrlForMaintenance } from "../src/lib/postgres";
import { createS3Client, requireBucket, serverSideEncryption } from "../src/lib/s3";

const TEMP_PREFIXES = ["temp/", "tmp/", "uploads/tmp/"];
const PROTECTED_PREFIXES = ["backups/", "archives/"];

export function classifyStorageObject(input: {
  key: string;
  ageHours: number;
  referenced: boolean;
  tempMaxAgeHours: number;
  orphanMinAgeHours: number;
}): "delete-temp" | "delete-orphan" | "keep" {
  const { key } = input;
  if (!key || key.startsWith("/") || key.includes("..")) {
    return "keep";
  }
  if (PROTECTED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return "keep";
  }
  if (TEMP_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    if (input.referenced) return "keep";
    return input.ageHours >= input.tempMaxAgeHours ? "delete-temp" : "keep";
  }
  if (key.startsWith("uploads/") && !input.referenced && input.ageHours >= input.orphanMinAgeHours) {
    return "delete-orphan";
  }
  return "keep";
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function isInside(parent: string, target: string): boolean {
  const rel = relative(parent, target);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && !rel.includes(":"));
}

async function cleanTempFiles(root: string, maxAgeMs: number): Promise<number> {
  const resolvedRoot = resolve(root);
  try {
    const info = await lstat(resolvedRoot);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`TEMP_DIR is not a real directory: ${resolvedRoot}`);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return 0;
    throw error;
  }

  async function walk(directory: string): Promise<number> {
    if (!isInside(resolvedRoot, directory)) return 0;
    const entries = await readdir(directory, { withFileTypes: true });
    let removed = 0;
    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      const info = await lstat(fullPath);
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory()) {
        removed += await walk(fullPath);
        continue;
      }
      if (!info.isFile()) continue;
      if (Date.now() - info.mtimeMs >= maxAgeMs) {
        await unlink(fullPath);
        removed += 1;
      }
    }
    return removed;
  }

  return walk(resolvedRoot);
}

async function loadReferencedKeys(connectionString: string): Promise<{ keys: Set<string>; tableEmpty: boolean }> {
  const pool = createPgPool(connectionString);
  try {
    const present = await pool.query<{ name: string | null }>("SELECT to_regclass('public.media_objects') AS name");
    if (!present.rows[0]?.name) {
      throw new Error("public.media_objects is missing. Create it with a storage_key column before cleaning S3 objects.");
    }
    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'media_objects'`,
    );
    const names = columns.rows.map((row) => row.column_name);
    const keyColumn = ["storage_key", "s3_key", "object_key"].find((candidate) => names.includes(candidate));
    if (!keyColumn) {
      throw new Error(`media_objects has no storage key column. Found: ${names.join(", ") || "(none)"}`);
    }

    const keys = new Set<string>();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DECLARE media_keys NO SCROLL CURSOR FOR SELECT ${keyColumn} AS storage_key FROM media_objects`);
      while (true) {
        const page = await client.query<{ storage_key: string | null }>("FETCH 1000 FROM media_keys");
        if (page.rows.length === 0) break;
        for (const row of page.rows) {
          if (row.storage_key) keys.add(row.storage_key);
        }
      }
      await client.query("CLOSE media_keys");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { keys, tableEmpty: keys.size === 0 };
  } finally {
    await pool.end();
  }
}

async function listAllObjects(bucket: string): Promise<_Object[]> {
  const client = createS3Client();
  const objects: _Object[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    objects.push(...(page.Contents ?? []));
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function deleteKeys(bucket: string, keys: string[]): Promise<void> {
  const client = createS3Client();
  for (let index = 0; index < keys.length; index += 1000) {
    const chunk = keys.slice(index, index + 1000).map((key) => ({ Key: key }));
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: chunk, Quiet: true } }));
  }
}

async function archiveAuditLogs(connectionString: string, bucket: string, retentionDays: number): Promise<number> {
  const pool = createPgPool(connectionString);
  const directory = await mkdtemp(join(tmpdir(), "dickrank-audit-"));
  try {
    const present = await pool.query<{ name: string | null }>("SELECT to_regclass('public.audit_logs') AS name");
    if (!present.rows[0]?.name) {
      throw new Error("public.audit_logs is missing. Create it before archiving audit history.");
    }
    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_logs'`,
    );
    const names = new Set(columns.rows.map((row) => row.column_name));
    if (!names.has("id") || !names.has("created_at")) {
      throw new Error("audit_logs must include id and created_at columns");
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const jsonlPath = join(directory, "audit.jsonl");
    const output = createWriteStream(jsonlPath);
    const ids: string[] = [];
    let lastCreated: string | null = null;
    let lastId: string | null = null;

    type AuditRow = { id: string; created_at: Date; data: unknown };

    while (true) {
      const page: QueryResult<AuditRow> = await pool.query<AuditRow>(
        `SELECT id::text AS id, created_at, to_jsonb(audit_logs) AS data
         FROM audit_logs
         WHERE created_at < $1
           AND ($2::timestamptz IS NULL OR (created_at, id::text) > ($2::timestamptz, $3::text))
         ORDER BY created_at ASC, id ASC
         LIMIT 1000`,
        [cutoff.toISOString(), lastCreated, lastId],
      );
      if (page.rows.length === 0) break;
      for (const row of page.rows) {
        output.write(`${JSON.stringify(row.data)}\n`);
        ids.push(row.id);
        lastCreated = row.created_at.toISOString();
        lastId = row.id;
      }
    }
    output.end();
    await finished(output);

    if (ids.length === 0) {
      return 0;
    }

    const plaintext = gzipSync(await readFile(jsonlPath));
    const encrypted = encryptBuffer(plaintext, requireEncryptionKey());
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const objectKey = `archives/audit-logs/${stamp.slice(0, 10)}/${stamp}.jsonl.gz.enc`;
    const client = createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: encrypted,
        ContentLength: encrypted.length,
        ContentType: "application/octet-stream",
        ...serverSideEncryption(),
      }),
    );

    for (let index = 0; index < ids.length; index += 1000) {
      const chunk = ids.slice(index, index + 1000);
      await pool.query("DELETE FROM audit_logs WHERE id::text = ANY($1::text[])", [chunk]);
    }

    await writeAuditEvent({
      action: "audit_logs.archived",
      metadata: { bucket, key: objectKey, rows: ids.length, retentionDays },
    });
    return ids.length;
  } finally {
    await pool.end();
    await rm(directory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const tempDir = process.env.TEMP_DIR?.trim() || join(process.cwd(), "tmp");
  const tempFileHours = positiveInt("TEMP_FILE_MAX_AGE_HOURS", 24);
  const tempObjectHours = positiveInt("TEMP_OBJECT_MAX_AGE_HOURS", 24);
  const orphanHours = positiveInt("ORPHAN_MIN_AGE_HOURS", 48);
  const auditDays = positiveInt("AUDIT_LOG_RETENTION_DAYS", 90);
  const bucket = requireBucket();
  const connectionString = databaseUrlForMaintenance();

  await mkdir(tempDir, { recursive: true });
  const removedFiles = await cleanTempFiles(tempDir, tempFileHours * 60 * 60 * 1000);
  console.log(`Removed ${removedFiles} temp file(s) from ${resolve(tempDir)}.`);

  const { keys: referenced, tableEmpty } = await loadReferencedKeys(connectionString);
  const allowEmpty = process.env.CLEANUP_ALLOW_EMPTY_MEDIA_INDEX === "true";
  const now = Date.now();
  const objects = await listAllObjects(bucket);
  const tempKeys: string[] = [];
  const orphanKeys: string[] = [];

  for (const object of objects) {
    if (!object.Key || !object.LastModified) continue;
    const ageHours = (now - object.LastModified.getTime()) / (60 * 60 * 1000);
    const decision = classifyStorageObject({
      key: object.Key,
      ageHours,
      referenced: referenced.has(object.Key),
      tempMaxAgeHours: tempObjectHours,
      orphanMinAgeHours: orphanHours,
    });
    if (decision === "delete-temp") tempKeys.push(object.Key);
    if (decision === "delete-orphan") orphanKeys.push(object.Key);
  }

  await deleteKeys(bucket, tempKeys);
  let removedOrphans = 0;
  if (orphanKeys.length > 0 && tableEmpty && !allowEmpty) {
    console.error(
      `Refusing to delete ${orphanKeys.length} upload object(s) because media_objects has no keys. Set CLEANUP_ALLOW_EMPTY_MEDIA_INDEX=true to override.`,
    );
  } else {
    await deleteKeys(bucket, orphanKeys);
    removedOrphans = orphanKeys.length;
  }

  if (tempKeys.length > 0 || removedOrphans > 0) {
    await writeAuditEvent({
      action: "s3.temp_cleaned",
      metadata: {
        bucket,
        tempObjectsRemoved: tempKeys.length,
        orphanedUploadsRemoved: removedOrphans,
        referencedKeys: referenced.size,
      },
    });
  }

  const archived = await archiveAuditLogs(connectionString, bucket, auditDays);
  console.log(
    `S3 cleanup removed ${tempKeys.length} temp object(s) and ${removedOrphans} orphan upload(s). Archived ${archived} audit row(s).`,
  );
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Cleanup failed";
    console.error(message);
    process.exit(1);
  });
}
