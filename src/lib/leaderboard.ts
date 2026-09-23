import { unstable_cache } from 'next/cache';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

export type CachedContentRow = {
  contentId: string;
  title: string;
  creatorId: string;
  creatorName: string;
  averageScore: number;
  ratingCount: number;
};

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object') {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export type CachedCreatorRow = {
  creatorId: string;
  creatorName: string;
  averageScore: number;
  ratingCount: number;
};

async function queryContent(limit: number): Promise<CachedContentRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.content.findMany({
    where: {
      scanStatus: 'CLEAN',
      visibility: 'PUBLIC',
      ratingCount: { gt: 0 },
    },
    orderBy: [{ averageScore: 'desc' }, { ratingCount: 'desc' }],
    take: limit,
    include: { creator: { include: { profile: true } } },
  });
  return rows.map((row) => ({
    contentId: row.id,
    title: row.title,
    creatorId: row.creatorId,
    creatorName: row.creator.profile?.displayName ?? 'Creator',
    averageScore: row.averageScore,
    ratingCount: row.ratingCount,
  }));
}

async function queryCreators(limit: number): Promise<CachedCreatorRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<
    Array<{ id: string; display_name: string; average_score: number | null; rating_count: number | null }>
  >(Prisma.sql`
    SELECT u.id,
           p.display_name,
           SUM(c.average_score * c.rating_count) / NULLIF(SUM(c.rating_count), 0) AS average_score,
           SUM(c.rating_count)::int AS rating_count
    FROM users u
    INNER JOIN profiles p ON p.user_id = u.id
    INNER JOIN contents c ON c.creator_id = u.id
    WHERE c.scan_status = 'CLEAN'::"scan_status"
      AND c.visibility = 'PUBLIC'::"content_visibility"
      AND c.rating_count > 0
    GROUP BY u.id, p.display_name
    ORDER BY average_score DESC, rating_count DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    creatorId: row.id,
    creatorName: row.display_name,
    averageScore: asNumber(row.average_score),
    ratingCount: asNumber(row.rating_count),
  }));
}

export const getCachedContentLeaderboard = unstable_cache(queryContent, ['leaderboard-content'], {
  revalidate: 60,
  tags: ['leaderboard'],
});

export const getCachedCreatorLeaderboard = unstable_cache(queryCreators, ['leaderboard-creators'], {
  revalidate: 60,
  tags: ['leaderboard'],
});
