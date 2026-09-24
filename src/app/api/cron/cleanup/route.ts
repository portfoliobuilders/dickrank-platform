import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isCronAuthorized } from '@/lib/cron-auth';
import { prisma } from '@/lib/prisma';
import { deleteUpload } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const REJECTED_CONTENT_DAYS = 7;
const AUDIT_LOG_DAYS = 90;

const cronAuthSchema = z.object({
  authorization: z.string().startsWith('Bearer '),
});

export async function GET(req: NextRequest) {
  const parsed = cronAuthSchema.safeParse({
    authorization: req.headers.get('authorization') ?? '',
  });
  if (!parsed.success || !isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const rejectedBefore = new Date(now.getTime() - REJECTED_CONTENT_DAYS * DAY_MS);
    const logsBefore = new Date(now.getTime() - AUDIT_LOG_DAYS * DAY_MS);

    const rejected = await prisma.content.findMany({
      where: {
        moderationStatus: 'REJECTED',
        updatedAt: { lt: rejectedBefore },
      },
      select: { id: true, mediaKey: true },
    });

    for (const content of rejected) {
      if (content.mediaKey) {
        await deleteUpload(content.mediaKey);
      }
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const removed =
        rejected.length === 0
          ? { count: 0 }
          : await tx.content.deleteMany({
              where: { id: { in: rejected.map((content) => content.id) } },
            });

      await tx.auditLog.create({
        data: {
          action: 'cleanup.rejected_content',
          entityType: 'Content',
          metadata: {
            deletedContent: removed.count,
            olderThanDays: REJECTED_CONTENT_DAYS,
          },
        },
      });

      return removed.count;
    });

    const archivedLogs = await prisma.auditLog.count({
      where: { createdAt: { lt: logsBefore } },
    });

    return NextResponse.json({
      success: true,
      results: {
        deletedUsers: 0,
        deletedContent: deleted,
        cleanedSessions: 0,
        archivedLogs,
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Cleanup cron error:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
