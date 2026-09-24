import { ModerationStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/audit';
import { decryptPii } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';

export const moderationStatusTabSchema = z.enum(['pending', 'approved', 'rejected']);
export const moderationDecisionSchema = z.object({
  contentId: z.string().trim().min(1).max(128),
  decision: z.enum(['approve', 'reject']),
});

export type ModerationStatusTab = z.infer<typeof moderationStatusTabSchema>;

const PENDING_STATUSES: ModerationStatus[] = [
  ModerationStatus.PENDING,
  ModerationStatus.FLAGGED,
  ModerationStatus.MANUAL_REVIEW,
];

export function statusesForTab(tab: ModerationStatusTab): ModerationStatus[] {
  if (tab === 'approved') return [ModerationStatus.APPROVED];
  if (tab === 'rejected') return [ModerationStatus.REJECTED];
  return PENDING_STATUSES;
}

export function tabForStatus(status: ModerationStatus): ModerationStatusTab {
  if (status === ModerationStatus.APPROVED) return 'approved';
  if (status === ModerationStatus.REJECTED) return 'rejected';
  return 'pending';
}

type ScoreRow = {
  name?: string;
  parentName?: string;
  confidence?: number;
};

function asScoreRows(value: Prisma.JsonValue | null): ScoreRow[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as ScoreRow[];
  if (typeof value === 'object' && value !== null && Array.isArray((value as { scores?: unknown }).scores)) {
    return (value as { scores: ScoreRow[] }).scores;
  }
  return [];
}

export function deriveAiScore(moderationScores: Prisma.JsonValue | null): number {
  const rows = asScoreRows(moderationScores);
  if (rows.length === 0) return 0;
  const max = Math.max(...rows.map((row) => Number(row.confidence ?? 0)));
  return Math.round(Math.min(100, Math.max(0, max)));
}

export function deriveFlags(moderationScores: Prisma.JsonValue | null, rejectionReason: string | null): string[] {
  const rows = asScoreRows(moderationScores);
  const flags = rows
    .filter((row) => Number(row.confidence ?? 0) >= 50)
    .map((row) => row.name?.trim())
    .filter((name): name is string => Boolean(name));
  if (flags.length === 0 && rejectionReason) {
    return [rejectionReason];
  }
  return [...new Set(flags)].slice(0, 8);
}

function safeCreatorEmail(emailEncrypted: string | null | undefined): string {
  if (!emailEncrypted) return '';
  try {
    return decryptPii(emailEncrypted);
  } catch {
    return '';
  }
}

export async function listModerationQueue(tab: ModerationStatusTab) {
  const statuses = statusesForTab(tab);
  const [rows, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.content.findMany({
      where: { moderationStatus: { in: statuses } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        creator: {
          select: { username: true, emailEncrypted: true },
        },
      },
    }),
    prisma.content.count({ where: { moderationStatus: { in: PENDING_STATUSES } } }),
    prisma.content.count({ where: { moderationStatus: ModerationStatus.APPROVED } }),
    prisma.content.count({ where: { moderationStatus: ModerationStatus.REJECTED } }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    contentId: row.id,
    thumbnailUrl: row.thumbnailUrl || row.mediaUrl || '/placeholder-content.svg',
    title: row.title,
    creator: {
      username: row.creator.username,
      email: safeCreatorEmail(row.creator.emailEncrypted),
    },
    aiScore: deriveAiScore(row.moderationScores),
    flags: deriveFlags(row.moderationScores, row.rejectionReason),
    uploadedAt: row.createdAt.toISOString(),
    status: tabForStatus(row.moderationStatus),
  }));

  return {
    items,
    counts: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  };
}

export async function applyAdminModerationDecision(input: {
  contentId: string;
  decision: 'approve' | 'reject';
  adminId: string;
}) {
  const content = await prisma.content.findUnique({ where: { id: input.contentId } });
  if (!content) {
    return { ok: false as const, status: 404 as const, error: 'Content not found' };
  }

  const moderationStatus =
    input.decision === 'approve' ? ModerationStatus.APPROVED : ModerationStatus.REJECTED;
  const rejectionReason =
    input.decision === 'reject' ? 'Rejected by a moderator' : null;

  await prisma.$transaction(async (tx) => {
    await tx.content.update({
      where: { id: input.contentId },
      data: {
        moderationStatus,
        rejectionReason,
      },
    });

    await tx.manualReview.updateMany({
      where: { contentId: input.contentId, status: 'OPEN' },
      data: { status: input.decision === 'approve' ? 'APPROVED' : 'REJECTED' },
    });

    if (input.decision === 'reject') {
      await tx.notification.create({
        data: {
          userId: content.creatorId,
          type: 'CONTENT_REJECTED',
          message: 'Your upload was rejected by a moderator.',
        },
      });
    }
  });

  await writeAuditLog({
    actorId: input.adminId,
    action: input.decision === 'approve' ? 'moderation.approve' : 'moderation.reject',
    entity: 'content',
    entityId: input.contentId,
    metadata: { moderationStatus },
  });

  return { ok: true as const, moderationStatus };
}
