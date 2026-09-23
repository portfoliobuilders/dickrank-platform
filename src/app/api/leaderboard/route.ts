import { NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { withApi } from '@/lib/http';
import { getCachedContentLeaderboard, getCachedCreatorLeaderboard } from '@/lib/leaderboard';
import { getPrisma } from '@/lib/prisma';
import { leaderboardQuerySchema } from '@/lib/validations';
import type { LeaderboardResponse } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const account = await requireVerifiedUser();
  if (account.ageVerification !== true) {
    throw new HttpError('Age verification required', 403, 'AGE_VERIFICATION');
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  const rawKind = url.searchParams.get('kind');
  const parsed = leaderboardQuerySchema.parse({
    ...(rawLimit ? { limit: rawLimit } : {}),
    ...(rawKind ? { kind: rawKind } : {}),
  });

  if (parsed.kind === 'creators') {
    const rows = await getCachedCreatorLeaderboard(parsed.limit);
    const body: LeaderboardResponse = {
      kind: 'creators',
      generatedAt: new Date().toISOString(),
      entries: rows.map((row, index) => ({
        rank: index + 1,
        id: row.creatorId,
        title: row.creatorName,
        subtitle: 'Creator',
        averageScore: row.averageScore,
        ratingCount: row.ratingCount,
        canRate: false,
        viewerScore: null,
      })),
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  }

  const rows = await getCachedContentLeaderboard(parsed.limit);
  const mine = rows.length
    ? await getPrisma().rating.findMany({
        where: {
          userId: account.id,
          contentId: { in: rows.map((row) => row.contentId) },
        },
        select: { contentId: true, score: true },
      })
    : [];
  const scores = new Map(mine.map((row) => [row.contentId, row.score]));
  const body: LeaderboardResponse = {
    kind: 'content',
    generatedAt: new Date().toISOString(),
    entries: rows.map((row, index) => ({
      rank: index + 1,
      id: row.contentId,
      title: row.title,
      subtitle: row.creatorName,
      averageScore: row.averageScore,
      ratingCount: row.ratingCount,
      canRate: row.creatorId !== account.id,
      viewerScore: scores.get(row.contentId) ?? null,
    })),
  };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
});
