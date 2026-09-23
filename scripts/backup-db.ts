import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import {
  createS3Client,
  isDryRun,
  logAudit,
  parseDatabaseUrl,
  readOpsEnv,
  redactSecrets,
  type OpsEnv,
} from "./ops";

export const BACKUP_PREFIX = "backups/postgres/";
export const DEFAULT_RETENTION_DAYS = 30;

export function backupObjectKey(now: Date): string {
  const day = now.toISOString().slice(0, 10);
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `${BACKUP_PREFIX}${day}/dickrank-${stamp}.dump`;
}

/** True when a backup object is older than the retention window. Other keys are ignored. */
export function isExpiredBackup(
  key: string,
  lastModified: Date,
  now: Date,
  retentionDays: number = DEFAULT_RETENTION_DAYS,
): boolean {
  if (!key.startsWith(BACKUP_PREFIX)) return false;
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  return now.getTime() - lastModified.getTime() > maxAgeMs;
}

type ListedObject = { key: string; lastModified: Date };

export async function listBackupObjects(client: S3Client, bucket: string): Promise<ListedObject[]> {
  const objects: ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: BACKUP_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of page.Contents ?? []) {
      if (item.Key && item.LastModified) {
        objects.push({ key: item.Key, lastModified: item.LastModified });
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

export async function deleteObjectKeys(client: S3Client, bucket: string, keys: string[]): Promise<number> {
  const eligible = keys.filter((key) => key.startsWith(BACKUP_PREFIX));
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

function runPgDump(env: OpsEnv, outputFile: string): Promise<void> {
  const target = parseDatabaseUrl(env.DATABASE_URL);

  return new Promise((resolve, reject) => {
    const child = spawn(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", "--file", outputFile, "--dbname", target.database],
      {
        env: {
          ...process.env,
          PGHOST: target.host,
          PGPORT: target.port,
          PGUSER: target.user,
          PGPASSWORD: target.password,
          PGDATABASE: target.database,
          PGSSLMODE: env.DATABASE_SSL === "disable" ? "disable" : env.DATABASE_SSL,
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );

    const stderr: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      reject(new Error(redactSecrets(error.message)));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const message = redactSecrets(Buffer.concat(stderr).toString("utf8")).trim();
      reject(new Error(message || `pg_dump exited with code ${code}`));
    });
  });
}

async function uploadDump(client: S3Client, env: OpsEnv, filePath: string, key: string): Promise<number> {
  const file = await stat(filePath);
  const body = createReadStream(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BACKUP_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
      ...(env.AWS_KMS_KEY_ID
        ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: env.AWS_KMS_KEY_ID }
        : { ServerSideEncryption: "AES256" }),
    }),
  );
  return file.size;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const env = readOpsEnv(process.env);
  const dryRun = isDryRun(argv);
  const now = new Date();
  const key = backupObjectKey(now);
  const directory = await mkdtemp(join(tmpdir(), "dickrank-backup-"));
  const dumpPath = join(directory, "backup.dump");

  try {
    if (!dryRun) {
      await runPgDump(env, dumpPath);
      const handle = await open(dumpPath, "r");
      await handle.chmod(0o600);
      await handle.close();
    }

    const client = createS3Client(env);
    const bytes = dryRun ? 0 : await uploadDump(client, env, dumpPath, key);
    const existing = dryRun ? [] : await listBackupObjects(client, env.AWS_S3_BACKUP_BUCKET);
    const expired = existing
      .filter((item) => isExpiredBackup(item.key, item.lastModified, now, env.BACKUP_RETENTION_DAYS))
      .map((item) => item.key)
      .filter((item) => item !== key);
    const deleted = dryRun ? expired.length : await deleteObjectKeys(client, env.AWS_S3_BACKUP_BUCKET, expired);

    logAudit("database_backup", {
      dryRun,
      bucket: env.AWS_S3_BACKUP_BUCKET,
      key,
      bytes,
      retentionDays: env.BACKUP_RETENTION_DAYS,
      expiredDeleted: deleted,
      encryptedAtRest: true,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const invokedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? redactSecrets(error.message) : "database backup failed";
    console.error(JSON.stringify({ audit: true, event: "database_backup_failed", message }));
    process.exit(1);
  });
}
