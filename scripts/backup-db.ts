/**
 * Daily Postgres backup.
 *
 * Dumps the database with pg_dump (install postgresql-client on the host),
 * gzip-compresses it, encrypts it with ENCRYPTION_KEY, and uploads it to S3.
 * Objects under backups/database/ older than BACKUP_RETENTION_DAYS (default 30)
 * are deleted after a successful upload.
 *
 * Schedule (UTC), from a machine that can reach the database and S3:
 *   0 3 * * * npx tsx scripts/backup-db.ts
 *
 * Uses DIRECT_URL when set so the dump does not go through a connection pooler.
 */
import { spawn } from "node:child_process";
import { createCipheriv, randomBytes } from "node:crypto";
import { appendFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReadStream, createWriteStream, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeAuditEvent } from "../src/lib/audit";
import { requireEncryptionKey } from "../src/lib/encrypted-blob";
import { databaseUrlForMaintenance } from "../src/lib/postgres";
import { createS3Client, requireBucket, serverSideEncryption } from "../src/lib/s3";

const MAGIC = Buffer.from("DRBK");
const VERSION = 1;
const BACKUP_PREFIX = "backups/database/";
export const DEFAULT_BACKUP_RETENTION_DAYS = 30;

export function isOlderThanDays(lastModified: Date, now: Date, days: number): boolean {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return lastModified.getTime() < cutoff;
}

export function retentionDaysFromEnv(raw = process.env.BACKUP_RETENTION_DAYS): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_BACKUP_RETENTION_DAYS;
  }
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("BACKUP_RETENTION_DAYS must be a positive integer");
  }
  return days;
}

type DumpTarget = {
  host: string;
  port: string;
  user: string;
  database: string;
  password: string;
};

function parseDumpTarget(connectionString: string): DumpTarget {
  const url = new URL(connectionString);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database || !url.username) {
    throw new Error("Database URL must include a host, database name, and user");
  }
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    database,
    password: decodeURIComponent(url.password),
  };
}

async function dumpAndEncrypt(target: DumpTarget, key: Buffer, destination: string): Promise<void> {
  const dump = spawn(
    "pg_dump",
    ["-h", target.host, "-p", target.port, "-U", target.user, "-d", target.database, "--format=plain", "--no-owner", "--no-acl"],
    {
      env: { ...process.env, PGPASSWORD: target.password },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const stderrChunks: Buffer[] = [];
  dump.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  const closed = new Promise<number>((resolve, reject) => {
    dump.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error("pg_dump was not found. Install the PostgreSQL client tools on this host."));
        return;
      }
      reject(error);
    });
    dump.on("close", (code) => resolve(code ?? 1));
  });

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  writeFileSync(destination, Buffer.concat([MAGIC, Buffer.from([VERSION]), iv]));
  const output = createWriteStream(destination, { flags: "a" });

  if (!dump.stdout) {
    throw new Error("pg_dump did not provide a stdout stream");
  }

  await pipeline(dump.stdout, createGzip(), cipher, output);
  const exitCode = await closed;
  if (exitCode !== 0) {
    const detail = Buffer.concat(stderrChunks).toString("utf8").replace(target.password, "[redacted]");
    throw new Error(`pg_dump exited with status ${exitCode}${detail ? `: ${detail.trim()}` : ""}`);
  }
  await appendFile(destination, cipher.getAuthTag());
}

async function deleteExpiredBackups(bucket: string, days: number): Promise<number> {
  const client = createS3Client();
  const now = new Date();
  let continuationToken: string | undefined;
  let removed = 0;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: BACKUP_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );
    const expired = (page.Contents ?? []).filter((object) => {
      return object.Key && object.LastModified && isOlderThanDays(object.LastModified, now, days);
    });
    for (let index = 0; index < expired.length; index += 1000) {
      const chunk = expired.slice(index, index + 1000);
      const keys = chunk.flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));
      if (keys.length === 0) continue;
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
      removed += keys.length;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return removed;
}

async function main(): Promise<void> {
  const connectionString = databaseUrlForMaintenance();
  const key = requireEncryptionKey();
  const bucket = requireBucket();
  const days = retentionDaysFromEnv();
  const target = parseDumpTarget(connectionString);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const objectKey = `${BACKUP_PREFIX}${stamp.slice(0, 10)}/${stamp}.sql.gz.enc`;
  const directory = await mkdtemp(join(tmpdir(), "dickrank-backup-"));
  const filePath = join(directory, "backup.sql.gz.enc");

  try {
    await dumpAndEncrypt(target, key, filePath);
    const size = await stat(filePath);
    const client = createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: createReadStream(filePath),
        ContentLength: size.size,
        ContentType: "application/octet-stream",
        ...serverSideEncryption(),
      }),
    );
    const removed = await deleteExpiredBackups(bucket, days);
    await writeAuditEvent({
      action: "database.backup",
      metadata: { bucket, key: objectKey, bytes: size.size, retentionDays: days, expiredObjectsRemoved: removed },
    });
    console.log(`Backup uploaded to s3://${bucket}/${objectKey}. Removed ${removed} expired object(s).`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Backup failed";
    console.error(message);
    process.exit(1);
  });
}
