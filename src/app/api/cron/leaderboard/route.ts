import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isCronAuthorized } from '@/lib/cron-auth';
import { recalculateAllRankings } from '@/lib/leaderboard';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    const result = await recalculateAllRankings();
    const top10 = await prisma.leaderboardEntry.findMany({
      where: { category: 'overall', period: 'today' },
      orderBy: { rank: 'asc' },
      take: 10,
      select: { rank: true, score: true },
    });

    return NextResponse.json({
      success: true,
      updated: result.updated,
      top10: top10.map((entry) => ({ rank: entry.rank, score: entry.score })),
    });
  } catch (error) {
    console.error('Leaderboard cron error:', error);
    return NextResponse.json({ error: 'Failed to update leaderboard' }, { status: 500 });
  }
}
