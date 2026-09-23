import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { decryptPii, encryptPii, hashEmail, hashIp } from "@/lib/crypto";
import { logAction } from "@/lib/audit";
import { closePaymentAccount } from "@/lib/payments";
import { removeUserFromSearchIndex } from "@/lib/search-index";
import { deleteObject, getObject, putObject, signedDownloadUrl, storageConfigured } from "@/lib/storage";
import { notify } from "@/lib/notify";
import { HttpError } from "@/lib/http";
import {
  deletionExecuteAt,
  financialRetainUntil,
  logsPurgeAt,
  retentionPolicyText,
} from "@/lib/retention";
import { restoreReadyClaims } from "@/lib/dmca";

export type ExportedUserData = {
  exportedAt: string;
  retention: string;
  profile: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
    ageVerified: boolean;
    createdAt: string;
    deletionExecuteAt: string | null;
  };
  posts: Array<{ id: string; body: string; anonymized: boolean; createdAt: string }>;
  content: Array<{ id: string; url: string; title: string | null; storageKey: string | null; hidden: boolean; createdAt: string }>;
  payments: Array<{ id: string; amountCents: number; currency: string; description: string | null; createdAt: string; retainUntil: string }>;
  dmcaClaimsFiled: Array<{ id: string; contentUrl: string; description: string; contactInfo: string; status: string; createdAt: string }>;
  dmcaClaimsReceived: Array<{ id: string; contentUrl: string; status: string; createdAt: string }>;
  auditLogs: Array<{ id: string; action: string; resource: string; createdAt: string; ipAddressHash: string; userAgent: string | null }>;
};

export async function exportUserData(userId: string): Promise<ExportedUserData> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.anonymizedAt) {
    throw new HttpError(404, "Account not found");
  }

  const [posts, content, payments, filed, received, auditLogs] = await Promise.all([
    prisma.post.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.content.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.paymentRecord.findMany({ where: { OR: [{ userId }, { accountRef: userId }] }, orderBy: { createdAt: "asc" } }),
    prisma.dmcaClaim.findMany({ where: { claimantUserId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.dmcaClaim.findMany({ where: { contentOwnerId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    retention: retentionPolicyText(),
    profile: {
      id: user.id,
      email: decryptPii(user.emailEncrypted),
      displayName: user.displayName,
      role: user.role,
      ageVerified: user.ageVerified,
      createdAt: user.createdAt.toISOString(),
      deletionExecuteAt: user.deletionExecuteAt?.toISOString() ?? null,
    },
    posts: posts.map((post) => ({
      id: post.id,
      body: post.body,
      anonymized: post.anonymized,
      createdAt: post.createdAt.toISOString(),
    })),
    content: content.map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      storageKey: item.storageKey,
      hidden: item.hidden,
      createdAt: item.createdAt.toISOString(),
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      description: payment.description,
      createdAt: payment.createdAt.toISOString(),
      retainUntil: payment.retainUntil.toISOString(),
    })),
    dmcaClaimsFiled: filed.map((claim) => ({
      id: claim.id,
      contentUrl: claim.contentUrl,
      description: claim.description,
      contactInfo: decryptPii(claim.contactInfoEncrypted),
      status: claim.status,
      createdAt: claim.createdAt.toISOString(),
    })),
    dmcaClaimsReceived: received.map((claim) => ({
      id: claim.id,
      contentUrl: claim.contentUrl,
      status: claim.status,
      createdAt: claim.createdAt.toISOString(),
    })),
    auditLogs: auditLogs.map((entry) => ({
      id: entry.id,
      action: entry.action,
      resource: entry.resource,
      createdAt: entry.createdAt.toISOString(),
      ipAddressHash: entry.ipAddressHash,
      userAgent: entry.userAgent,
    })),
  };
}

async function buildExportZip(userId: string, data: ExportedUserData): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("data.json", JSON.stringify(data, null, 2));
  zip.file("RETENTION.txt", `${data.retention}\n`);

  if (userId && data.profile.ageVerified) {
    for (const item of data.content) {
      if (!item.storageKey || !storageConfigured()) continue;
      const bytes = await getObject(item.storageKey);
      if (!bytes) {
        zip.file(`media/${item.id}.missing.txt`, "This file was not in storage.\n");
        continue;
      }
      const extension = item.storageKey.split(".").pop() || "bin";
      zip.file(`media/${item.id}.${extension}`, bytes);
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

export async function enqueueUserExport(input: {
  userId: string;
  ipAddress: string;
  userAgent: string | null;
}) {
  const existing = await prisma.dataExportJob.findFirst({
    where: {
      userId: input.userId,
      status: { in: ["QUEUED", "PROCESSING", "READY"] },
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const job = await prisma.dataExportJob.create({
    data: { userId: input.userId, status: "QUEUED" },
  });
  await logAction({
    userId: input.userId,
    action: "settings_change",
    resource: `export:${job.id}`,
    details: { event: "export_queued" },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  return job;
}

export async function processExportJob(jobId: string): Promise<void> {
  const job = await prisma.dataExportJob.findUnique({ where: { id: jobId } });
  if (!job || (job.status !== "QUEUED" && job.status !== "PROCESSING")) return;

  await prisma.dataExportJob.update({ where: { id: jobId }, data: { status: "PROCESSING" } });
  try {
    const data = await exportUserData(job.userId);
    const zip = await buildExportZip(job.userId, data);
    const key = `exports/${job.userId}/${job.id}.zip`;
    if (!storageConfigured()) {
      throw new Error("AWS_S3_BUCKET is required to store the export archive");
    }
    await putObject(key, zip, "application/zip");
    const ready = await prisma.dataExportJob.update({
      where: { id: jobId },
      data: { status: "READY", storageKey: key, readyAt: new Date(), error: null },
    });
    const user = await prisma.user.findUnique({ where: { id: job.userId } });
    if (user && !user.anonymizedAt) {
      const downloadUrl = await signedDownloadUrl(key);
      await notify({
        userId: user.id,
        email: decryptPii(user.emailEncrypted),
        subject: "Your DickRank data export is ready",
        body: `Your export is ready. This download link expires in 15 minutes:\n${downloadUrl}\n\nYou can also request a fresh link while signed in. Job ${ready.id}.`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    await prisma.dataExportJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: message.slice(0, 500) },
    });
  }
}

export async function processQueuedExports() {
  const jobs = await prisma.dataExportJob.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  for (const job of jobs) {
    await processExportJob(job.id);
  }
  return jobs.map((job) => job.id);
}

export async function scheduleAccountDeletion(input: {
  userId: string;
  confirmation: "DELETE" | "CANCEL";
  ipAddress: string;
  userAgent: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.anonymizedAt) throw new HttpError(404, "Account not found");

  if (input.confirmation === "CANCEL") {
    if (user.terminatedAt) {
      throw new HttpError(403, "This account was terminated and the deletion cannot be cancelled");
    }
    if (!user.deletionExecuteAt) {
      throw new HttpError(409, "This account is not scheduled for deletion");
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { deletionRequestedAt: null, deletionExecuteAt: null },
    });
    await logAction({
      userId: user.id,
      action: "settings_change",
      resource: `user:${user.id}`,
      details: { event: "deletion_cancelled" },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return { status: "cancelled" as const, deletionExecuteAt: null, user: updated };
  }

  if (user.deletionExecuteAt && user.deletionExecuteAt.getTime() > Date.now()) {
    return { status: "scheduled" as const, deletionExecuteAt: user.deletionExecuteAt, user };
  }

  const requestedAt = new Date();
  const executeAt = deletionExecuteAt(requestedAt);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { deletionRequestedAt: requestedAt, deletionExecuteAt: executeAt },
  });
  await logAction({
    userId: user.id,
    action: "delete",
    resource: `user:${user.id}`,
    details: { event: "deletion_scheduled", deletionExecuteAt: executeAt.toISOString() },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  return { status: "scheduled" as const, deletionExecuteAt: executeAt, user: updated };
}

export async function deleteUserData(userId: string, meta: { ipAddress: string; userAgent: string | null }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Account not found");
  if (user.anonymizedAt) return { alreadyDeleted: true as const };

  const ipAddressHash = hashIp(meta.ipAddress);
  const contents = await prisma.content.findMany({ where: { ownerId: userId } });
  const storageKeys = contents.map((item) => item.storageKey).filter((key): key is string => Boolean(key));
  if (storageKeys.length > 0 && !storageConfigured()) {
    throw new Error("AWS_S3_BUCKET is required to delete stored media");
  }
  for (const key of storageKeys) {
    await deleteObject(key);
  }

  if (user.stripeAccountId) {
    await closePaymentAccount(user.stripeAccountId);
    await logAction({
      userId,
      action: "payment",
      resource: `user:${userId}`,
      details: { event: "payment_account_closed" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
  await removeUserFromSearchIndex({ userId, contentIds: contents.map((item) => item.id) });

  const anonymizedAt = new Date();
  const tombstoneEmail = `deleted-${user.id}@deleted.invalid`;

  await prisma.$transaction(async (tx) => {
    await tx.post.updateMany({
      where: { authorId: userId },
      data: { body: "[removed]", anonymized: true },
    });
    for (const item of contents) {
      await tx.content.update({
        where: { id: item.id },
        data: {
          title: null,
          url: `deleted:${item.id}`,
          storageKey: null,
          hidden: true,
          hiddenReason: "account_deleted",
        },
      });
    }
    await tx.paymentRecord.updateMany({
      where: { OR: [{ userId }, { accountRef: userId }] },
      data: { description: "retained-financial-record" },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        emailEncrypted: encryptPii(tombstoneEmail),
        emailHash: hashEmail(tombstoneEmail),
        displayName: null,
        stripeAccountId: null,
        anonymizedAt,
        ageVerified: false,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "DELETE",
        resource: `user:${userId}`,
        details: {
          event: "account_anonymized",
          logsPurgeAt: logsPurgeAt(anonymizedAt).toISOString(),
          financialRetentionYears: 7,
        },
        ipAddressHash,
        userAgent: meta.userAgent,
      },
    });
  });

  return { alreadyDeleted: false as const, anonymizedAt, logsPurgeAt: logsPurgeAt(anonymizedAt) };
}

export async function processDueAccountDeletions(now = new Date()) {
  const due = await prisma.user.findMany({
    where: {
      anonymizedAt: null,
      deletionExecuteAt: { lte: now },
    },
    take: 25,
  });
  const processed: string[] = [];
  for (const user of due) {
    await deleteUserData(user.id, { ipAddress: "system", userAgent: "retention-job" });
    processed.push(user.id);
  }
  return processed;
}

export async function purgeExpiredAuditLogs(now = new Date()) {
  const users = await prisma.user.findMany({
    where: { anonymizedAt: { not: null } },
    select: { id: true, anonymizedAt: true },
  });
  const userIds = users
    .filter((user) => user.anonymizedAt && logsPurgeAt(user.anonymizedAt).getTime() <= now.getTime())
    .map((user) => user.id);
  if (userIds.length === 0) return 0;
  const result = await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  return result.count;
}

export async function purgeExpiredFinancialRecords(now = new Date()) {
  const result = await prisma.paymentRecord.deleteMany({
    where: {
      retainUntil: { lte: now },
      user: { anonymizedAt: { not: null } },
    },
  });
  return result.count;
}

export async function runRetentionJobs(now = new Date()) {
  const deletedUsers = await processDueAccountDeletions(now);
  const restoredClaims = await restoreReadyClaims(now);
  const purgedLogs = await purgeExpiredAuditLogs(now);
  const purgedPayments = await purgeExpiredFinancialRecords(now);
  const exportsProcessed = await processQueuedExports();
  return { deletedUsers, restoredClaims, purgedLogs, purgedPayments, exportsProcessed };
}

export { financialRetainUntil, retentionPolicyText };
