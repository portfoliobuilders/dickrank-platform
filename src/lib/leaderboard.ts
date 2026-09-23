import { Prisma } from "@prisma/client";

import { safeAvatarUrl } from "@/lib/avatar";
import { boardLabel, periodLabel } from "@/lib/constants";
import { periodWindow, previousPeriodWindow, type Period } from "@/lib/periods";
import { prisma } from "@/lib/prisma";
import {
  rankCreators,
  rankRisingCreators,
  RATING_DIMENSIONS,
  trendFrom,
  type RankableCreator,
  type RankableRating,
  type RankedCreator,
  type RatingDimension,
  type ScoreBreakdown,
  type Trend,
} from "@/lib/ranking-algorithm";
import { cacheGet, cacheSet, invalidateLeaderboardCache } from "@/lib/redis";

export type LeaderboardStats = {
  averageRating: number;
  ratingCount: number;
  verifiedPartnerCount: number;
  activityPoints: number;
  healthVerified: boolean;
  contentQuality: number;
  communityEngagement: number;
  absoluteScore: number;
  breakdown: ScoreBreakdown;
};

export type LeaderboardRow = {
  rank: number;
  score: number;
  trend: Trend;
  previousRank: number | null;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  stats: LeaderboardStats;
};

export type LeaderboardResult = {
  rankings: LeaderboardRow[];
  category: string;
  period: Period;
  limit: number;
  generatedAt: string;
};

type BoardSlice = {
  category: string;
  dimension: RatingDimension;
  contentType?: string;
  rising: boolean;
};

const KNOWN_DIMENSIONS = new Set<string>(RATING_DIMENSIONS);

export function resolveBoard(category: string, type?: string): BoardSlice {
  if (category === "rising") {
    return { category: "rising", dimension: "overall", contentType: type, rising: true };
  }
  if (KNOWN_DIMENSIONS.has(category)) {
    return {
      category,
      dimension: category as RatingDimension,
      contentType: type,
      rising: false,
    };
  }
  return { category, dimension: "overall", contentType: category, rising: false };
}

type SourceData = {
  creators: RankableCreator[];
  ratings: RankableRating[];
};

async function loadSource(): Promise<SourceData> {
  const contents = await prisma.content.findMany({
    select: {
      id: true,
      type: true,
      qualityScore: true,
      creator: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          verifiedPartnerCount: true,
          activityPoints: true,
          healthVerified: true,
          communityEngagement: true,
        },
      },
      ratings: {
        select: {
          createdAt: true,
          feel: true,
          performance: true,
          experience: true,
          userExperience: true,
          weightedScore: true,
        },
      },
    },
  });

  const creators = new Map<string, RankableCreator>();
  const ratings: RankableRating[] = [];

  for (const content of contents) {
    creators.set(content.creator.id, {
      userId: content.creator.id,
      username: content.creator.username,
      avatarUrl: content.creator.avatarUrl,
      verifiedPartnerCount: content.creator.verifiedPartnerCount,
      activityPoints: content.creator.activityPoints,
      healthVerified: content.creator.healthVerified,
      communityEngagement: content.creator.communityEngagement,
    });

    for (const rating of content.ratings) {
      ratings.push({
        creatorId: content.creator.id,
        contentId: content.id,
        contentType: content.type,
        contentQuality: content.qualityScore,
        createdAt: rating.createdAt,
        feel: rating.feel,
        performance: rating.performance,
        experience: rating.experience,
        userExperience: rating.userExperience,
        weightedScore: rating.weightedScore,
      });
    }
  }

  return { creators: [...creators.values()], ratings };
}

function rankSlice(source: SourceData, slice: BoardSlice, period: Period, now: Date): RankedCreator[] {
  // All-time rising compares the last 30 days with the 30 days before that.
  const currentPeriod = slice.rising && period === "all" ? "month" : period;
  const current = periodWindow(currentPeriod, now);
  const ranked = rankCreators({
    creators: source.creators,
    ratings: source.ratings,
    dimension: slice.dimension,
    contentType: slice.contentType,
    start: current.start,
    end: current.end,
  });

  if (!slice.rising) return ranked;

  const previousWindow = previousPeriodWindow(currentPeriod, now);
  const previous = rankCreators({
    creators: source.creators,
    ratings: source.ratings,
    dimension: "overall",
    contentType: slice.contentType,
    start: previousWindow.start,
    end: previousWindow.end,
  });
  return rankRisingCreators(ranked, previous);
}

function toStats(creator: RankedCreator): LeaderboardStats {
  return {
    averageRating: creator.averageRating,
    ratingCount: creator.ratingCount,
    verifiedPartnerCount: creator.verifiedPartnerCount,
    activityPoints: creator.activityPoints,
    healthVerified: creator.healthVerified,
    contentQuality: creator.contentQuality,
    communityEngagement: creator.communityEngagement,
    absoluteScore: creator.absoluteScore,
    breakdown: creator.breakdown,
  };
}

function cacheKey(category: string, period: Period, limit: number, type?: string): string {
  return `leaderboard:v1:${category}:${period}:${limit}:${type ?? ""}`;
}

export async function getLeaderboard(input: {
  category: string;
  period: Period;
  limit: number;
  type?: string;
}): Promise<LeaderboardResult & { cached: boolean }> {
  const slice = resolveBoard(input.category, input.type);
  const key = cacheKey(slice.category, input.period, input.limit, slice.contentType);
  const cached = await cacheGet<LeaderboardResult>(key);
  if (cached) return { ...cached, cached: true };

  const now = new Date();
  const source = await loadSource();
  const ranked = rankSlice(source, slice, input.period, now).slice(0, input.limit);
  const snapshots = await prisma.leaderboardEntry.findMany({
    where: {
      category: slice.category,
      period: input.period,
      userId: { in: ranked.map((creator) => creator.userId) },
    },
    select: { userId: true, previousRank: true, cronInitialized: true },
  });
  const snapshotByUser = new Map(snapshots.map((entry) => [entry.userId, entry]));

  const result: LeaderboardResult = {
    category: slice.category,
    period: input.period,
    limit: input.limit,
    generatedAt: now.toISOString(),
    rankings: ranked.map((creator) => {
      const snapshot = snapshotByUser.get(creator.userId);
      const previousRank = snapshot?.cronInitialized ? snapshot.previousRank : null;
      return {
        rank: creator.rank,
        score: creator.score,
        trend: trendFrom(previousRank, creator.rank),
        previousRank,
        user: {
          id: creator.userId,
          username: creator.username,
          avatarUrl: safeAvatarUrl(creator.avatarUrl),
        },
        stats: toStats(creator),
      };
    }),
  };

  await cacheSet(key, result);
  return { ...result, cached: false };
}

const STORED_TYPES = ["video", "photo", "story", "live"];

function slicesToRefresh(contentType: string): Array<{ category: string; period: Period }> {
  const categories = [
    "overall",
    "feel",
    "performance",
    "experience",
    "userExperience",
    "rising",
    contentType,
  ];
  const periods: Period[] = ["all", "today", "week", "month"];
  return categories.flatMap((category) => periods.map((period) => ({ category, period })));
}

/**
 * Refreshes stored rows after a new review.
 * The daily job owns rank-change alerts, so this path does not notify.
 */
export async function refreshLeaderboardForContent(contentType: string): Promise<void> {
  const source = await loadSource();
  const now = new Date();
  for (const target of slicesToRefresh(contentType)) {
    const slice = resolveBoard(target.category);
    const ranked = rankSlice(source, slice, target.period, now);
    await persistSlice(slice.category, target.period, ranked, { notify: false });
  }
  await invalidateLeaderboardCache();
}

export async function recalculateAllRankings(): Promise<{ updated: number; notifications: number }> {
  const source = await loadSource();
  const now = new Date();
  const categories = [
    "overall",
    "feel",
    "performance",
    "experience",
    "userExperience",
    "rising",
    ...STORED_TYPES,
  ];
  const periods: Period[] = ["today", "week", "month", "all"];

  let updated = 0;
  let notifications = 0;
  for (const category of categories) {
    for (const period of periods) {
      const slice = resolveBoard(category);
      const ranked = rankSlice(source, slice, period, now);
      const result = await persistSlice(slice.category, period, ranked, { notify: true });
      updated += result.updated;
      notifications += result.notifications;
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "leaderboard.recalculate",
      entityType: "LeaderboardEntry",
      metadata: { updated, notifications, at: now.toISOString() },
    },
  });
  await invalidateLeaderboardCache();
  return { updated, notifications };
}

async function persistSlice(
  category: string,
  period: Period,
  ranked: RankedCreator[],
  options: { notify: boolean },
): Promise<{ updated: number; notifications: number }> {
  const existing = await prisma.leaderboardEntry.findMany({
    where: { category, period },
  });
  const existingByUser = new Map(existing.map((entry) => [entry.userId, entry]));
  const messages: Array<{ userId: string; message: string }> = [];
  const label = boardLabel(category);
  const when = periodLabel(period);

  for (const creator of ranked) {
    const prior = existingByUser.get(creator.userId);
    if (options.notify && prior?.cronInitialized && prior.previousRank !== creator.rank) {
      const from = prior.previousRank == null ? "unranked" : `#${prior.previousRank}`;
      const movedUp = prior.previousRank != null && creator.rank < prior.previousRank;
      messages.push({
        userId: creator.userId,
        message: movedUp
          ? `You moved up from ${from} to #${creator.rank} on the ${label} board (${when}).`
          : `Your place on the ${label} board (${when}) is now #${creator.rank}. It was ${from}.`,
      });
    }
  }

  if (options.notify) {
    for (const prior of existing) {
      const stillListed = ranked.some((creator) => creator.userId === prior.userId);
      if (!stillListed && prior.cronInitialized) {
        messages.push({
          userId: prior.userId,
          message: `You dropped off the ${label} board (${when}).`,
        });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const creator of ranked) {
      const prior = existingByUser.get(creator.userId);
      const stats = toStats(creator) as unknown as Prisma.InputJsonValue;
      const calculatedAt = new Date();
      // The daily job stores today's rank as the baseline for the next run.
      // Review traffic updates the live score without moving that baseline.
      const snapshot = prior?.cronInitialized ? prior.previousRank : null;

      await tx.leaderboardEntry.upsert({
        where: {
          userId_category_period: { userId: creator.userId, category, period },
        },
        create: {
          userId: creator.userId,
          category,
          period,
          score: creator.score,
          rank: creator.rank,
          previousRank: options.notify ? creator.rank : null,
          cronInitialized: options.notify,
          trend: "same",
          stats,
          calculatedAt,
        },
        update: options.notify
          ? {
              score: creator.score,
              rank: creator.rank,
              previousRank: creator.rank,
              cronInitialized: true,
              trend: trendFrom(snapshot, creator.rank),
              stats,
              calculatedAt,
            }
          : {
              score: creator.score,
              rank: creator.rank,
              trend: trendFrom(snapshot, creator.rank),
              stats,
              calculatedAt,
            },
      });
    }

    if (options.notify) {
      const keep = ranked.map((creator) => creator.userId);
      await tx.leaderboardEntry.deleteMany({
        where: {
          category,
          period,
          ...(keep.length > 0 ? { userId: { notIn: keep } } : {}),
        },
      });
      if (messages.length > 0) {
        await tx.notification.createMany({
          data: messages.map((message) => ({
            userId: message.userId,
            type: "RANK_CHANGE",
            message: message.message,
          })),
        });
      }
    }
  });

  return { updated: ranked.length, notifications: messages.length };
}
