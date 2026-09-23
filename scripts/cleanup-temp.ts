import { readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";
import {
  createS3Client,
  isDryRun,
  logAudit,
  parseDatabaseUrl,
  readOpsEnv,
  redactSecrets,
  type OpsEnv,
} from "./ops";

export const ORPHAN_PREFIXES = ["temp/", "uploads/tmp/"] as const;
export const DEFAULT_ORPHAN_MAX_AGE_HOURS = 24;
export const DEFAULT_AUDIT_ARCHIVE_DAYS = 90;

export function isOrphanedObject(
  key: string,
  lastModified: Date,
  now: Date,
  maxAgeHours: number = DEFAULT_ORPHAN_MAX_AGE_HOURS,
): boolean {
  if (!ORPHAN_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  return now.getTime() - lastModified.getTime() > maxAgeHours * 60 * 60 * 1000;
}

export function isStaleTempFile(mtimeMs: number, now: Date, maxAgeHours: number): boolean {
  return now.getTime() - mtimeMs > maxAgeHours * 60 * 60 * 1000;
}

export function auditCutoff(now: Date, days: number = DEFAULT_AUDIT_ARCHIVE_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Reject filesystem roots so a bad TEMP_DIR cannot wipe the machine. */
export function assertSafeTempDir(dir: string): string {
  const resolved = resolve(dir);
  if (resolved === parse(resolved).root) {
    throw new Error("Refusing to clean the filesystem root");
  }
  return resolved;
}

export function defaultTempDir(): string {
  return join(tmpdir(), "dickrank");
}

async function listStaleFiles(directory: string, now: Date, maxAgeHours: number): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }

  const stale: string[] = [];
  for (const name of names) {
    const fullPath = join(directory, name);
    const info = await stat(fullPath);
    if (!info.isFile()) continue;
    if (isStaleTempFile(info.mtimeMs, now, maxAgeHours)) stale.push(fullPath);
  }
  return stale;
}

async function listOrphanedObjects(client: S3Client, bucket: string, now: Date, maxAgeHours: number): Promise<string[]> {
  const keys: string[] = [];

  for (const prefix of ORPHAN_PREFIXES) {
    let continuationToken: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of page.Contents ?? []) {
        if (item.Key && item.LastModified && isOrphanedObject(item.Key, item.LastModified, now, maxAgeHours)) {
          keys.push(item.Key);
        }
      }

      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return keys;
}

async function deleteKeys(client: S3Client, bucket: string, keys: string[]): Promise<number> {
  const eligible = keys.filter((key) => ORPHAN_PREFIXES.some((prefix) => key.startsWith(prefix)));
  let deleted = 0;

  for (let index = 0; index < eligible.length; index += 1000) {
    const chunk = eligible.slice(index, index + 1000);
    if (chunk.length === 0) continue;
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((key) => ({ Key: key })), Quiet: true },
      }),
    );
    deleted += chunk.length - (result.Errors?.length ?? 0);
  }

  return deleted;
}

type AuditColumn = { column_name: string };

async function archiveAuditLogs(env: OpsEnv, client: S3Client, now: Date, dryRun: boolean): Promise<number> {
  const target = parseDatabaseUrl(env.DATABASE_URL);
  const db = new pg.Client({
    host: target.host,
    port: Number(target.port),
    user: target.user,
    password: target.password,
    database: target.database,
    ssl: env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: true },
  });

  await db.connect();
  try {
    const table = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'audit_logs'
       ) AS exists`,
    );
    if (!table.rows[0]?.exists) {
      logAudit("audit_log_archive_skipped", { reason: "table_missing" });
      return 0;
    }

    const columns = await db.query<AuditColumn>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_logs'`,
    );
    const names = new Set(columns.rows.map((row) => row.column_name));
    if (!names.has("id") || !names.has("created_at")) {
      logAudit("audit_log_archive_skipped", { reason: "required_columns_missing" });
      return 0;
    }

    const cutoff = auditCutoff(now, env.AUDIT_LOG_ARCHIVE_DAYS);
    const count = await db.query<{ count: string }>("SELECT count(*)::text AS count FROM audit_logs WHERE created_at < $1", [
      cutoff,
    ]);
    const total = Number(count.rows[0]?.count ?? "0");
    if (dryRun || total === 0) return total;

    const batchSize = 1000;
    const maxBatches = Math.ceil(total / batchSize) + 1;
    let archived = 0;
    let batches = 0;

    while (archived < total && batches < maxBatches) {
      batches += 1;
      const batch = await db.query<Record<string, unknown>>(
        "SELECT * FROM audit_logs WHERE created_at < $1 ORDER BY created_at ASC LIMIT $2",
        [cutoff, batchSize],
      );
      if (batch.rows.length === 0) break;

      const ids = batch.rows.map((row) => String(row.id));
      const key = `audit-archive/audit_logs/${cutoff.toISOString().slice(0, 10)}/${now.getTime()}-${archived}.jsonl`;
      const body = batch.rows.map((row) => JSON.stringify(row)).join("\n");

      await client.send(
        new PutObjectCommand({
          Bucket: env.AWS_S3_BACKUP_BUCKET,
          Key: key,
          Body: body,
          ContentType: "application/x-ndjson",
          ...(env.AWS_KMS_KEY_ID
            ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: env.AWS_KMS_KEY_ID }
            : { ServerSideEncryption: "AES256" }),
        }),
      );

      await db.query("DELETE FROM audit_logs WHERE id::text = ANY($1::text[]) AND created_at < $2", [ids, cutoff]);
      archived += batch.rows.length;
      logAudit("audit_log_archive_batch", { key, rows: batch.rows.length });
    }

    return archived;
  } finally {
    await db.end();
  }
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const env = readOpsEnv(process.env);
  const dryRun = isDryRun(argv);
  const now = new Date();
  const tempDir = assertSafeTempDir(env.TEMP_DIR ?? defaultTempDir());
  const staleFiles = await listStaleFiles(tempDir, now, env.TEMP_FILE_MAX_AGE_HOURS);

  if (!dryRun) {
    await Promise.all(staleFiles.map((file) => rm(file, { force: true })));
  }

  const mediaBucket = env.AWS_S3_BUCKET;
  const client = createS3Client(env);
  const orphanKeys = mediaBucket
    ? await listOrphanedObjects(client, mediaBucket, now, env.ORPHAN_OBJECT_MAX_AGE_HOURS)
    : [];
  const orphansDeleted = !mediaBucket || dryRun ? 0 : await deleteKeys(client, mediaBucket, orphanKeys);
  const auditRows = await archiveAuditLogs(env, client, now, dryRun);

  logAudit("cleanup_temp", {
    dryRun,
    tempDir,
    tempFilesRemoved: dryRun ? 0 : staleFiles.length,
    tempFilesMatched: staleFiles.length,
    orphanedObjectsMatched: orphanKeys.length,
    orphanedObjectsRemoved: dryRun ? 0 : orphansDeleted,
    auditRowsArchived: dryRun ? 0 : auditRows,
    auditRowsMatched: auditRows,
  });
}

const invokedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? redactSecrets(error.message) : "cleanup failed";
    console.error(JSON.stringify({ audit: true, event: "cleanup_temp_failed", message }));
    process.exit(1);
  });
}
