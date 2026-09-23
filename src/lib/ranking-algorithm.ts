/**
 * Creator ranking.
 *
 * A review's weighted score blends the four category marks.
 * A creator's board score then blends six signals:
 *   average ratings 40%, verified partners 20%, activity 15%,
 *   health verification 10%, content quality 10%, community 5%.
 * The result is a 0–100 score. Higher is better.
 */

export const CATEGORY_WEIGHTS = {
  feel: 0.3,
  performance: 0.25,
  experience: 0.25,
  userExperience: 0.2,
} as const;

export const RANKING_WEIGHTS = {
  averageRatings: 0.4,
  verifiedPartners: 0.2,
  activityPoints: 0.15,
  healthVerification: 0.1,
  contentQuality: 0.1,
  communityEngagement: 0.05,
} as const;

/** Full marks for the count-based signals. */
export const RANKING_CAPS = {
  verifiedPartners: 10,
  activityPoints: 1000,
  communityEngagement: 100,
} as const;

export const RATING_DIMENSIONS = [
  "overall",
  "feel",
  "performance",
  "experience",
  "userExperience",
] as const;

export type RatingDimension = (typeof RATING_DIMENSIONS)[number];

export type Trend = "up" | "down" | "same";

export type CategoryScores = {
  feel: number;
  performance: number;
  experience: number;
  userExperience: number;
};

export type ScoreBreakdown = {
  averageRatings: number;
  verifiedPartners: number;
  activityPoints: number;
  healthVerification: number;
  contentQuality: number;
  communityEngagement: number;
  total: number;
};

export type RankingFactors = {
  averageRating: number;
  verifiedPartnerCount: number;
  activityPoints: number;
  healthVerified: boolean;
  contentQuality: number;
  communityEngagement: number;
};

export type RankableCreator = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  verifiedPartnerCount: number;
  activityPoints: number;
  healthVerified: boolean;
  communityEngagement: number;
};

export type RankableRating = {
  creatorId: string;
  contentId: string;
  contentType: string;
  contentQuality: number;
  createdAt: Date;
  feel: number;
  performance: number;
  experience: number;
  userExperience: number;
  weightedScore: number;
};

export type RankedCreator = RankableCreator & {
  score: number;
  rank: number;
  ratingCount: number;
  averageRating: number;
  contentQuality: number;
  absoluteScore: number;
  breakdown: ScoreBreakdown;
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function calculateWeightedRating(scores: CategoryScores): number {
  return round2(
    scores.feel * CATEGORY_WEIGHTS.feel +
      scores.performance * CATEGORY_WEIGHTS.performance +
      scores.experience * CATEGORY_WEIGHTS.experience +
      scores.userExperience * CATEGORY_WEIGHTS.userExperience,
  );
}

export function calculateScore(factors: RankingFactors): ScoreBreakdown {
  const averageRatings = clamp01(factors.averageRating / 10) * 100 * RANKING_WEIGHTS.averageRatings;
  const verifiedPartners =
    clamp01(factors.verifiedPartnerCount / RANKING_CAPS.verifiedPartners) *
    100 *
    RANKING_WEIGHTS.verifiedPartners;
  const activityPoints =
    clamp01(factors.activityPoints / RANKING_CAPS.activityPoints) * 100 * RANKING_WEIGHTS.activityPoints;
  const healthVerification = (factors.healthVerified ? 1 : 0) * 100 * RANKING_WEIGHTS.healthVerification;
  const contentQuality =
    clamp01(factors.contentQuality / 10) * 100 * RANKING_WEIGHTS.contentQuality;
  const communityEngagement =
    clamp01(factors.communityEngagement / RANKING_CAPS.communityEngagement) *
    100 *
    RANKING_WEIGHTS.communityEngagement;

  const total = round2(
    averageRatings +
      verifiedPartners +
      activityPoints +
      healthVerification +
      contentQuality +
      communityEngagement,
  );

  return {
    averageRatings: round2(averageRatings),
    verifiedPartners: round2(verifiedPartners),
    activityPoints: round2(activityPoints),
    healthVerification: round2(healthVerification),
    contentQuality: round2(contentQuality),
    communityEngagement: round2(communityEngagement),
    total,
  };
}

export function trendFrom(previousRank: number | null, rank: number): Trend {
  if (previousRank == null || previousRank === rank) return "same";
  return previousRank > rank ? "up" : "down";
}

type ScoredCreator = Omit<RankedCreator, "rank">;

function ratingValue(rating: RankableRating, dimension: RatingDimension): number {
  if (dimension === "overall") return rating.weightedScore;
  return rating[dimension];
}

function inWindow(createdAt: Date, start?: Date | null, end?: Date | null): boolean {
  const time = createdAt.getTime();
  if (start && time < start.getTime()) return false;
  if (end && time >= end.getTime()) return false;
  return true;
}

/**
 * Turns creator profiles and reviews into a score-sorted board.
 * Creators with no matching reviews are left off.
 */
export function rankCreators(options: {
  creators: RankableCreator[];
  ratings: RankableRating[];
  dimension: RatingDimension;
  contentType?: string;
  start?: Date | null;
  end?: Date | null;
}): RankedCreator[] {
  const creatorsById = new Map(options.creators.map((creator) => [creator.userId, creator]));
  const totals = new Map<
    string,
    { ratingSum: number; ratingCount: number; qualityByContent: Map<string, number> }
  >();

  for (const rating of options.ratings) {
    if (options.contentType && rating.contentType !== options.contentType) continue;
    if (!inWindow(rating.createdAt, options.start, options.end)) continue;
    if (!creatorsById.has(rating.creatorId)) continue;

    const bucket = totals.get(rating.creatorId) ?? {
      ratingSum: 0,
      ratingCount: 0,
      qualityByContent: new Map<string, number>(),
    };
    bucket.ratingSum += ratingValue(rating, options.dimension);
    bucket.ratingCount += 1;
    bucket.qualityByContent.set(rating.contentId, rating.contentQuality);
    totals.set(rating.creatorId, bucket);
  }

  const scored: ScoredCreator[] = [];
  for (const [userId, bucket] of totals) {
    const creator = creatorsById.get(userId);
    if (!creator || bucket.ratingCount === 0) continue;

    const averageRating = round2(bucket.ratingSum / bucket.ratingCount);
    const qualities = [...bucket.qualityByContent.values()];
    const contentQuality = round2(qualities.reduce((sum, value) => sum + value, 0) / qualities.length);
    const breakdown = calculateScore({
      averageRating,
      verifiedPartnerCount: creator.verifiedPartnerCount,
      activityPoints: creator.activityPoints,
      healthVerified: creator.healthVerified,
      contentQuality,
      communityEngagement: creator.communityEngagement,
    });

    scored.push({
      ...creator,
      score: breakdown.total,
      ratingCount: bucket.ratingCount,
      averageRating,
      contentQuality,
      absoluteScore: breakdown.total,
      breakdown,
    });
  }

  return assignRanks(scored);
}

/**
 * Rising stars are creators whose board score improved versus the previous window.
 * The returned score is the gain. `absoluteScore` is the current board score.
 */
export function rankRisingCreators(current: RankedCreator[], previous: RankedCreator[]): RankedCreator[] {
  const previousScore = new Map(previous.map((creator) => [creator.userId, creator.absoluteScore]));
  const gainers: ScoredCreator[] = [];

  for (const creator of current) {
    const before = previousScore.get(creator.userId) ?? 0;
    const gain = round2(creator.absoluteScore - before);
    if (gain <= 0) continue;
    gainers.push({
      ...creator,
      score: gain,
      absoluteScore: creator.absoluteScore,
    });
  }

  return assignRanks(gainers);
}

function assignRanks(creators: ScoredCreator[]): RankedCreator[] {
  const sorted = [...creators].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    return a.userId.localeCompare(b.userId);
  });

  return sorted.map((creator, index) => ({
    ...creator,
    rank: index + 1,
  }));
}
