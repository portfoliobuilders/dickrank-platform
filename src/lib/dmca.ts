import { DmcaStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptPii, encryptPii, hashIp } from "@/lib/crypto";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/audit";
import {
  DMCA_CLAIM_HOURLY_LIMIT,
  REPEAT_INFRINGER_STRIKE_LIMIT,
  dmcaRestoreAt,
  deletionExecuteAt,
} from "@/lib/retention";
import { HttpError } from "@/lib/http";

const ACTIVE_HIDE_STATUSES: DmcaStatus[] = ["PENDING_REVIEW", "APPROVED", "COUNTER_NOTIFIED"];

export async function submitDmcaClaim(input: {
  contentUrl: string;
  description: string;
  contactInfo: string;
  signature: true;
  claimantUserId: string | null;
  ipAddress: string;
  userAgent: string | null;
}) {
  const ipAddressHash = hashIp(input.ipAddress);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.dmcaClaim.count({
    where: { ipAddressHash, createdAt: { gte: since } },
  });
  if (recent >= DMCA_CLAIM_HOURLY_LIMIT) {
    throw new HttpError(429, "Too many copyright claims from this network. Try again later.");
  }

  let url: URL;
  try {
    url = new URL(input.contentUrl);
  } catch {
    throw new HttpError(400, "Content URL is not valid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, "Content URL must be a web address");
  }

  const matches = await prisma.content.findMany({ where: { url: input.contentUrl } });
  const primary = matches[0] ?? null;

  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.dmcaClaim.create({
      data: {
        contentId: primary?.id ?? null,
        contentUrl: input.contentUrl,
        description: input.description,
        contactInfoEncrypted: encryptPii(input.contactInfo),
        signature: input.signature,
        status: "PENDING_REVIEW",
        claimantUserId: input.claimantUserId,
        contentOwnerId: primary?.ownerId ?? null,
        ipAddressHash,
      },
    });

    if (matches.length > 0) {
      await tx.content.updateMany({
        where: { id: { in: matches.map((row) => row.id) } },
        data: { hidden: true, hiddenReason: "dmca_pending" },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: input.claimantUserId,
        action: "REPORT",
        resource: `dmca:${created.id}`,
        details: { event: "dmca_claim", contentFound: matches.length > 0 },
        ipAddressHash,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
      },
    });

    return created;
  });

  if (primary) {
    const owner = await prisma.user.findUnique({ where: { id: primary.ownerId } });
    if (owner && !owner.anonymizedAt) {
      try {
        const email = decryptPii(owner.emailEncrypted);
        await notify({
          userId: owner.id,
          email,
          subject: "A copyright claim was filed on your content",
          body: [
            "Someone submitted a DMCA takedown request for one of your posts.",
            `Claim: ${claim.id}`,
            "The content is hidden while we review it.",
            "If you believe this was a mistake, sign in and file a counter-notice at https://dickrank.online/dmca.",
            "Do not reply with identity documents.",
          ].join("\n"),
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Owner notice failed");
      }
    }
  }

  return { claim, contentHidden: matches.length > 0 };
}

export async function submitCounterNotice(input: {
  claimId: string;
  statement: string;
  contactInfo: string;
  ownerId: string;
  ipAddress: string;
  userAgent: string | null;
}) {
  const claim = await prisma.dmcaClaim.findUnique({ where: { id: input.claimId } });
  if (!claim) throw new HttpError(404, "Copyright claim not found");
  if (claim.contentOwnerId !== input.ownerId) {
    throw new HttpError(403, "Only the content owner can file a counter-notice");
  }
  if (claim.status !== "PENDING_REVIEW" && claim.status !== "APPROVED") {
    throw new HttpError(409, "This claim cannot be countered");
  }

  const filedAt = new Date();
  const restoreAt = dmcaRestoreAt(filedAt);
  const updated = await prisma.dmcaClaim.update({
    where: { id: claim.id },
    data: {
      status: "COUNTER_NOTIFIED",
      counterStatement: input.statement,
      counterContactEncrypted: encryptPii(input.contactInfo),
      counterFiledAt: filedAt,
      restoreAt,
      lawsuitFiled: false,
    },
  });

  await logAction({
    userId: input.ownerId,
    action: "report",
    resource: `dmca:${claim.id}`,
    details: { event: "counter_notice", restoreAt: restoreAt.toISOString() },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  const claimantEmail = decryptPii(claim.contactInfoEncrypted);
  await notify({
    userId: claim.claimantUserId,
    email: claimantEmail,
    subject: "A counter-notice was filed on your DMCA claim",
    body: [
      `Claim ${claim.id} received a counter-notice from the content owner.`,
      `If you do not tell us that you filed a lawsuit, the content may be restored on ${restoreAt.toISOString().slice(0, 10)}.`,
      "Reply to dmca@dickrank.online with the lawsuit filing details if you have sued.",
    ].join("\n"),
  });

  return updated;
}

async function refreshVisibility(contentId: string | null) {
  if (!contentId) return;
  const open = await prisma.dmcaClaim.count({
    where: { contentId, status: { in: ACTIVE_HIDE_STATUSES } },
  });
  if (open === 0) {
    await prisma.content.update({
      where: { id: contentId },
      data: { hidden: false, hiddenReason: null },
    });
  }
}

export async function reviewDmcaClaim(input: {
  claimId: string;
  decision: "approve" | "reject" | "lawsuit";
  reviewerId: string;
  ipAddress: string;
  userAgent: string | null;
}) {
  const claim = await prisma.dmcaClaim.findUnique({
    where: { id: input.claimId },
    include: { content: true },
  });
  if (!claim) throw new HttpError(404, "Copyright claim not found");

  if (input.decision === "lawsuit") {
    const updated = await prisma.dmcaClaim.update({
      where: { id: claim.id },
      data: { lawsuitFiled: true, restoreAt: null },
    });
    await logAction({
      userId: input.reviewerId,
      action: "settings_change",
      resource: `dmca:${claim.id}`,
      details: { event: "lawsuit_filed" },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return updated;
  }

  if (claim.status !== "PENDING_REVIEW" && claim.status !== "COUNTER_NOTIFIED") {
    throw new HttpError(409, "This claim was already reviewed");
  }

  if (input.decision === "reject") {
    const updated = await prisma.dmcaClaim.update({
      where: { id: claim.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: input.reviewerId,
        restoreAt: null,
      },
    });
    await refreshVisibility(claim.contentId);
    await logAction({
      userId: input.reviewerId,
      action: "settings_change",
      resource: `dmca:${claim.id}`,
      details: { event: "dmca_rejected" },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return updated;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const approved = await tx.dmcaClaim.update({
      where: { id: claim.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: input.reviewerId,
        restoreAt: null,
      },
    });
    if (claim.contentId) {
      await tx.content.update({
        where: { id: claim.contentId },
        data: { hidden: true, hiddenReason: "dmca_takedown" },
      });
    }
    return approved;
  });

  await logAction({
    userId: input.reviewerId,
    action: "delete",
    resource: claim.contentId ? `content:${claim.contentId}` : `dmca:${claim.id}`,
    details: { event: "dmca_approved", claimId: claim.id },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  if (claim.contentOwnerId) {
    const upheld = await prisma.dmcaClaim.count({
      where: { contentOwnerId: claim.contentOwnerId, status: "APPROVED" },
    });
    if (upheld >= REPEAT_INFRINGER_STRIKE_LIMIT) {
      const now = new Date();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: claim.contentOwnerId },
          data: {
            suspendedAt: now,
            terminatedAt: now,
            deletionRequestedAt: now,
            deletionExecuteAt: deletionExecuteAt(now),
          },
        }),
        prisma.content.updateMany({
          where: { ownerId: claim.contentOwnerId },
          data: { hidden: true, hiddenReason: "repeat_infringer" },
        }),
      ]);
      await logAction({
        userId: input.reviewerId,
        action: "delete",
        resource: `user:${claim.contentOwnerId}`,
        details: { event: "repeat_infringer_terminated", upheld },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    }
  }

  return updated;
}

export async function restoreReadyClaims(now = new Date()) {
  const due = await prisma.dmcaClaim.findMany({
    where: {
      status: "COUNTER_NOTIFIED",
      lawsuitFiled: false,
      restoreAt: { lte: now },
    },
  });

  const restored: string[] = [];
  for (const claim of due) {
    await prisma.dmcaClaim.update({
      where: { id: claim.id },
      data: { status: "RESTORED" },
    });
    await refreshVisibility(claim.contentId);
    restored.push(claim.id);

    const owner = claim.contentOwnerId
      ? await prisma.user.findUnique({ where: { id: claim.contentOwnerId } })
      : null;
    try {
      if (owner && !owner.anonymizedAt) {
        await notify({
          userId: owner.id,
          email: decryptPii(owner.emailEncrypted),
          subject: "Your content was restored",
          body: `Claim ${claim.id} passed the waiting period with no lawsuit on file. The content is visible again unless another claim is still open.`,
        });
      }
      await notify({
        userId: claim.claimantUserId,
        email: decryptPii(claim.contactInfoEncrypted),
        subject: "Content was restored after a counter-notice",
        body: `Claim ${claim.id} was restored because no lawsuit was recorded during the waiting period.`,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Restore notice failed");
    }
  }
  return restored;
}

export async function listDmcaClaims(status?: DmcaStatus) {
  return prisma.dmcaClaim.findMany({
    where: status ? { status } : undefined,
    include: {
      content: { select: { id: true, title: true, url: true, mediaKind: true, hidden: true, ownerId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function claimantContact(encrypted: string): string {
  return decryptPii(encrypted);
}
