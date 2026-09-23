import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { canViewContent } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { requireVerifiedUser } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { clientIpHash, withApi } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { rateSchema } from '@/lib/validations';
import type { RateResponse } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(async (request) => {
  const account = await requireVerifiedUser();
  if (account.ageVerification !== true) {
    throw new HttpError('Age verification required', 403, 'AGE_VERIFICATION');
  }
  if (!rateLimit(`rate:${account.id}`, 60, 60 * 60 * 1000)) {
    throw new HttpError('Too many ratings. Try again later.', 429);
  }

  const parsed = rateSchema.parse(await request.json());
  const prisma = getPrisma();
  const content = await prisma.content.findUnique({ where: { id: parsed.contentId } });
  if (!content || content.scanStatus !== 'CLEAN') {
    throw new HttpError('That upload is not available', 404);
  }
  if (content.creatorId === account.id) {
    throw new HttpError('You cannot rate your own upload', 403);
  }
  if (!(await canViewContent(account, content))) {
    throw new HttpError('That upload is not available', 404);
  }

  const ipHash = clientIpHash(request);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.rating.findUnique({
      where: { userId_contentId: { userId: account.id, contentId: content.id } },
    });
    const rating = existing
      ? await tx.rating.update({
          where: { id: existing.id },
          data: { score: parsed.score, comment: parsed.comment },
        })
      : await tx.rating.create({
          data: {
            userId: account.id,
            contentId: content.id,
            score: parsed.score,
            comment: parsed.comment,
          },
        });
    const aggregate = await tx.rating.aggregate({
      where: { contentId: content.id },
      _avg: { score: true },
      _count: { score: true },
    });
    const averageScore = aggregate._avg.score ?? 0;
    const ratingCount = aggregate._count.score;
    await tx.content.update({
      where: { id: content.id },
      data: { averageScore, ratingCount },
    });
    await writeAudit(tx, {
      actorId: account.id,
      action: existing ? 'update' : 'create',
      entityType: 'rating',
      entityId: rating.id,
      metadata: { score: parsed.score, contentId: content.id },
      ipHash,
    });
    return { rating, averageScore, ratingCount, updated: Boolean(existing) };
  });

  revalidateTag('leaderboard');

  const body: RateResponse = {
    rating: {
      id: result.rating.id,
      score: result.rating.score,
      contentId: result.rating.contentId,
    },
    averageScore: result.averageScore,
    ratingCount: result.ratingCount,
    updated: result.updated,
  };
  return NextResponse.json(body);
});
