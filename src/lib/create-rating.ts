import { Prisma } from "@prisma/client";

import type { SignedInUser } from "@/lib/auth";
import { HttpError } from "@/lib/auth";
import { refreshLeaderboardForContent } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { calculateWeightedRating, round2 } from "@/lib/ranking-algorithm";
import type { CreateRatingInput } from "@/lib/validation";

export async function createRating(user: SignedInUser, input: CreateRatingInput) {
  const content = await prisma.content.findUnique({
    where: { id: input.contentId },
    select: { id: true, creatorId: true, type: true },
  });
  if (!content) {
    throw new HttpError("That content could not be found.", 404);
  }
  if (content.creatorId === user.id) {
    throw new HttpError("You can't rate your own content.", 403);
  }

  const weightedScore = calculateWeightedRating(input);
  const alreadyRated = await prisma.rating.findUnique({
    where: { contentId_userId: { contentId: content.id, userId: user.id } },
    select: { id: true },
  });
  if (alreadyRated) {
    throw new HttpError("You already rated this content.", 409);
  }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: {
          contentId: content.id,
          userId: user.id,
          overall: input.overall,
          feel: input.feel,
          performance: input.performance,
          experience: input.experience,
          userExperience: input.userExperience,
          weightedScore,
          pros: input.pros,
          cons: input.cons,
          review: input.review,
          anonymous: input.anonymous,
        },
      });

      const aggregate = await tx.rating.aggregate({
        where: { contentId: content.id },
        _avg: { weightedScore: true },
        _count: { _all: true },
      });
      const ratingAverage = round2(aggregate._avg.weightedScore ?? 0);
      const ratingCount = aggregate._count._all;
      await tx.content.update({
        where: { id: content.id },
        data: { ratingAverage, ratingCount },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "rating.create",
          entityType: "Rating",
          entityId: rating.id,
          metadata: {
            contentId: content.id,
            creatorId: content.creatorId,
            weightedScore,
            anonymous: input.anonymous,
          },
        },
      });

      return { rating, ratingAverage, ratingCount };
    });

    try {
      await refreshLeaderboardForContent(content.type);
    } catch (error) {
      console.error("Leaderboard refresh failed after a new rating.", error);
    }

    return {
      rating: saved.rating,
      content: {
        id: content.id,
        ratingAverage: saved.ratingAverage,
        ratingCount: saved.ratingCount,
      },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError("You already rated this content.", 409);
    }
    throw error;
  }
}
