import { describe, expect, it } from "vitest";

import { safeAvatarUrl } from "@/lib/avatar";
import { isCronAuthorized } from "@/lib/cron-auth";
import { periodWindow, previousPeriodWindow } from "@/lib/periods";
import {
  calculateScore,
  calculateWeightedRating,
  CATEGORY_WEIGHTS,
  rankCreators,
  rankRisingCreators,
  RANKING_WEIGHTS,
  type RankableCreator,
  type RankableRating,
} from "@/lib/ranking-algorithm";
import { createRatingSchema, isHalfStep, leaderboardQuerySchema } from "@/lib/validation";

const weights = Object.values(RANKING_WEIGHTS);
const categoryWeights = Object.values(CATEGORY_WEIGHTS);

function creator(overrides: Partial<RankableCreator> = {}): RankableCreator {
  return {
    userId: "user-a",
    username: "ace",
    avatarUrl: null,
    verifiedPartnerCount: 0,
    activityPoints: 0,
    healthVerified: false,
    communityEngagement: 0,
    ...overrides,
  };
}

function rating(overrides: Partial<RankableRating> = {}): RankableRating {
  return {
    creatorId: "user-a",
    contentId: "content-1",
    contentType: "video",
    contentQuality: 10,
    createdAt: new Date("2026-09-23T12:00:00Z"),
    feel: 10,
    performance: 10,
    experience: 10,
    userExperience: 10,
    weightedScore: 10,
    ...overrides,
  };
}

describe("review and ranking scores", () => {
  it("weights add up to a full score", () => {
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
    expect(categoryWeights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
  });

  it("gives a perfect creator 100 points", () => {
    const score = calculateScore({
      averageRating: 10,
      verifiedPartnerCount: 10,
      activityPoints: 1000,
      healthVerified: true,
      contentQuality: 10,
      communityEngagement: 100,
    });
    expect(score.total).toBe(100);
    expect(score.averageRatings).toBe(40);
    expect(score.verifiedPartners).toBe(20);
    expect(score.activityPoints).toBe(15);
    expect(score.healthVerification).toBe(10);
    expect(score.contentQuality).toBe(10);
    expect(score.communityEngagement).toBe(5);
  });

  it("gives an empty profile zero and caps extra activity", () => {
    expect(
      calculateScore({
        averageRating: 0,
        verifiedPartnerCount: 0,
        activityPoints: 0,
        healthVerified: false,
        contentQuality: 0,
        communityEngagement: 0,
      }).total,
    ).toBe(0);

    const capped = calculateScore({
      averageRating: 10,
      verifiedPartnerCount: 500,
      activityPoints: 99999,
      healthVerified: true,
      contentQuality: 10,
      communityEngagement: 99999,
    });
    expect(capped.total).toBe(100);
  });

  it("blends category marks into one weighted review score", () => {
    expect(calculateWeightedRating({ feel: 10, performance: 10, experience: 10, userExperience: 10 })).toBe(10);
    expect(calculateWeightedRating({ feel: 8, performance: 6, experience: 6, userExperience: 4 })).toBe(6.2);
  });

  it("accepts half-point scores and rejects the rest", () => {
    expect(isHalfStep(1)).toBe(true);
    expect(isHalfStep(7.5)).toBe(true);
    expect(isHalfStep(10)).toBe(true);
    expect(isHalfStep(7.25)).toBe(false);
    const good = createRatingSchema.safeParse({
      contentId: "content-1",
      overall: 8,
      feel: 7.5,
      performance: 8,
      experience: 9,
      userExperience: 6.5,
      review: "A detailed note about the session and how it felt.",
    });
    expect(good.success).toBe(true);
    const bad = createRatingSchema.safeParse({
      contentId: "content-1",
      overall: 8.2,
      feel: 7,
      performance: 8,
      experience: 9,
      userExperience: 6,
      review: "too short",
    });
    expect(bad.success).toBe(false);
  });

  it("keeps the user experience category name intact", () => {
    const parsed = leaderboardQuerySchema.parse({
      category: "userExperience",
      period: "week",
      limit: "10",
    });
    expect(parsed.category).toBe("userExperience");
    expect(parsed.limit).toBe(10);
  });
});

describe("sorted rankings", () => {
  const now = new Date("2026-09-23T18:00:00Z");
  const creators = [
    creator({ userId: "low", username: "low" }),
    creator({
      userId: "high",
      username: "high",
      verifiedPartnerCount: 10,
      activityPoints: 1000,
      healthVerified: true,
      communityEngagement: 100,
    }),
  ];

  it("sorts higher scores first and skips creators with no reviews", () => {
    const ranked = rankCreators({
      creators: [...creators, creator({ userId: "quiet", username: "quiet" })],
      ratings: [
        rating({ creatorId: "low", weightedScore: 2, feel: 2, performance: 2, experience: 2, userExperience: 2, contentQuality: 2 }),
        rating({ creatorId: "high", contentId: "content-2", weightedScore: 10, contentQuality: 10 }),
      ],
      dimension: "overall",
    });
    expect(ranked.map((entry) => entry.userId)).toEqual(["high", "low"]);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
    expect(ranked.some((entry) => entry.userId === "quiet")).toBe(false);
  });

  it("can rank from one category and one content type", () => {
    const ranked = rankCreators({
      creators,
      ratings: [
        rating({ creatorId: "low", feel: 10, weightedScore: 2, contentType: "photo" }),
        rating({ creatorId: "high", contentId: "content-2", feel: 4, weightedScore: 10, contentType: "video" }),
      ],
      dimension: "feel",
      contentType: "photo",
    });
    expect(ranked.map((entry) => entry.userId)).toEqual(["low"]);
    expect(ranked[0]?.averageRating).toBe(10);
  });

  it("respects the time window", () => {
    const window = periodWindow("today", now);
    const ranked = rankCreators({
      creators,
      ratings: [
        rating({ creatorId: "low", createdAt: new Date("2026-09-22T12:00:00Z"), weightedScore: 10 }),
        rating({ creatorId: "high", contentId: "content-2", createdAt: new Date("2026-09-23T09:00:00Z"), weightedScore: 5 }),
      ],
      dimension: "overall",
      start: window.start,
      end: window.end,
    });
    expect(ranked.map((entry) => entry.userId)).toEqual(["high"]);
  });

  it("lists rising creators by how much their score improved", () => {
    const current = rankCreators({
      creators,
      ratings: [
        rating({ creatorId: "low", weightedScore: 9, contentQuality: 9 }),
        rating({ creatorId: "high", contentId: "content-2", weightedScore: 8, contentQuality: 8 }),
      ],
      dimension: "overall",
    });
    const previous = rankCreators({
      creators,
      ratings: [
        rating({ creatorId: "low", weightedScore: 2, contentQuality: 2 }),
        rating({ creatorId: "high", contentId: "content-2", weightedScore: 8, contentQuality: 8 }),
      ],
      dimension: "overall",
    });
    const rising = rankRisingCreators(current, previous);
    expect(rising.map((entry) => entry.userId)).toEqual(["low"]);
    expect(rising[0]?.score).toBeGreaterThan(0);
    expect(rising[0]?.absoluteScore).toBeGreaterThan(rising[0]?.score ?? 0);
  });
});

describe("time windows", () => {
  const now = new Date("2026-09-23T18:00:00Z");

  it("starts today at midnight UTC and leaves all-time open", () => {
    expect(periodWindow("today", now).start?.toISOString()).toBe("2026-09-23T00:00:00.000Z");
    expect(periodWindow("all", now)).toEqual({ start: null, end: null });
    const week = periodWindow("week", now);
    expect(week.start?.toISOString()).toBe("2026-09-16T18:00:00.000Z");
  });

  it("places the previous window directly before the current one", () => {
    const previous = previousPeriodWindow("week", now);
    expect(previous.end?.toISOString()).toBe("2026-09-16T18:00:00.000Z");
    expect(previous.start?.toISOString()).toBe("2026-09-09T18:00:00.000Z");
  });
});

describe("safety helpers", () => {
  it("drops avatar urls that are not web links", () => {
    expect(safeAvatarUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(safeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(safeAvatarUrl("not a url")).toBeNull();
  });

  it("requires the daily job secret", () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(new Request("http://localhost/api/leaderboard/update"))).toBe(false);
    process.env.CRON_SECRET = "top-secret-value";
    expect(
      isCronAuthorized(
        new Request("http://localhost/api/leaderboard/update", {
          headers: { authorization: "Bearer top-secret-value" },
        }),
      ),
    ).toBe(true);
    expect(
      isCronAuthorized(
        new Request("http://localhost/api/leaderboard/update", {
          headers: { authorization: "Bearer wrong" },
        }),
      ),
    ).toBe(false);
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });
});
