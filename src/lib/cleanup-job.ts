import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { gzipSync } from "node:zlib";

import { encryptBuffer, requireEncryptionKey } from "@/lib/encrypted-blob";
import { prisma } from "@/lib/prisma";
import { createS3Client, requireBucket, serverSideEncryption } from "@/lib/s3";

const DAY_MS = 24 * 60 * 60 * 1000;
const PROTECTED_PREFIXES = ["archives/", "backups/"];
const USER_BATCH = 25;
const CONTENT_BATCH = 100;
const LOG_BATCH = 500;

export const USER_GRACE_DAYS = 30;
export const REJECTED_CONTENT_DAYS = 7;
export const DEFAULT_AUDIT_RETENTION_DAYS = 90;

export type CleanupResults = {
  deletedUsers: number;
  deletedContent: number;
  cleanedSessions: number;
  archivedLogs: number;
};

export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export function auditRetentionDays(): number {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_AUDIT_RETENTION_DAYS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("AUDIT_LOG_RETENTION_DAYS must be a positive integer");
  }
  return value;
}

/** Only keys this app stored are eligible. URLs are never parsed into keys. */
export function deletableStorageKey(mediaKey: string | null | undefined): string | null {
  if (!mediaKey) return null;
  const key = mediaKey.trim();
  if (!key || key.length > 1024) return null;
  if (key.startsWith("/") || key.includes("\\") || key.includes("\0")) return null;
  if (PROTECTED_PREFIXES.some((prefix) => key.startsWith(prefix))) return null;
  const parts = key.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  return key;
}

async function deleteStoredObject(client: S3Client, bucket: string, key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function runCleanup(now = new Date()): Promise<CleanupResults> {
  const results: CleanupResults = {
    deletedUsers: 0,
    deletedContent: 0,
    cleanedSessions: 0,
    archivedLogs: 0,
  };

  const bucket = requireBucket();
  const s3 = createS3Client();

  const users = await prisma.user.findMany({
    where: { deleteRequestedAt: { lt: retentionCutoff(now, USER_GRACE_DAYS) } },
    include: { content: { select: { id: true, mediaKey: true } } },
    take: USER_BATCH,
    orderBy: { deleteRequestedAt: "asc" },
  });

  for (const user of users) {
    const keys = [...new Set(user.content.map((item) => deletableStorageKey(item.mediaKey)).filter((key): key is string => Boolean(key)))];
    for (const key of keys) {
      await deleteStoredObject(s3, bucket, key);
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "user.purged",
          entityType: "User",
          entityId: user.id,
          metadata: { contentCount: user.content.length, objectCount: keys.length },
        },
      });
      await tx.user.delete({ where: { id: user.id } });
    });
    results.deletedUsers += 1;
  }

  const rejected = await prisma.content.findMany({
    where: {
      moderationStatus: "REJECTED",
      deletedAt: null,
      updatedAt: { lt: retentionCutoff(now, REJECTED_CONTENT_DAYS) },
    },
    select: { id: true, creatorId: true },
    take: CONTENT_BATCH,
    orderBy: { updatedAt: "asc" },
  });

  for (const content of rejected) {
    await prisma.$transaction(async (tx) => {
      await tx.content.update({
        where: { id: content.id },
        data: { deletedAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId: content.creatorId,
          action: "content.soft_deleted",
          entityType: "Content",
          entityId: content.id,
          metadata: { reason: "rejected_expired" },
        },
      });
    });
    results.deletedContent += 1;
  }

  const oldLogs = await prisma.auditLog.findMany({
    where: { createdAt: { lt: retentionCutoff(now, auditRetentionDays()) } },
    orderBy: { createdAt: "asc" },
    take: LOG_BATCH,
  });

  if (oldLogs.length > 0) {
    const plaintext = gzipSync(Buffer.from(oldLogs.map((row) => JSON.stringify(row)).join("\n") + "\n"));
    const encrypted = encryptBuffer(plaintext, requireEncryptionKey());
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const objectKey = `archives/audit-logs/${stamp.slice(0, 10)}/${stamp}.jsonl.gz.enc`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: encrypted,
        ContentLength: encrypted.length,
        ContentType: "application/octet-stream",
        ...serverSideEncryption(),
      }),
    );
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { id: { in: oldLogs.map((row) => row.id) } } });
      await tx.auditLog.create({
        data: {
          action: "audit_logs.archived",
          entityType: "AuditLog",
          metadata: { key: objectKey, rows: oldLogs.length },
        },
      });
    });
    results.archivedLogs = oldLogs.length;
  }

  return results;
}
