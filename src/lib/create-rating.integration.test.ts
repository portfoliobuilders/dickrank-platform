import { afterAll, describe, expect, it } from "vitest";

import { createRating } from "@/lib/create-rating";
import { getLeaderboard, recalculateAllRankings } from "@/lib/leaderboard";
import { presentRater } from "@/lib/present-rating";
import { prisma } from "@/lib/prisma";

const prefix = `test-rank-${Date.now()}`;
const highId = `${prefix}-high`;
const midId = `${prefix}-mid`;
const lowId = `${prefix}-low`;
const raterId = `${prefix}-rater`;
const otherRaterId = `${prefix}-other`;

const review = "Clear notes about feel, pace, and the overall session.";

async function makeUser(id: string, username: string, stats?: {
  verifiedPartnerCount?: number;
  activityPoints?: number;
  healthVerified?: boolean;
  communityEngagement?: number;
}) {
  await prisma.user.create({
    data: {
      id,
      username,
      ageVerification: true,
      verified: true,
      verifiedPartnerCount: stats?.verifiedPartnerCount ?? 0,
      activityPoints: stats?.activityPoints ?? 0,
      healthVerified: stats?.healthVerified ?? false,
      communityEngagement: stats?.communityEngagement ?? 0,
    },
  });
}

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("rating and leaderboard database", () => {
  afterAll(async () => {
    const userIds = [highId, midId, lowId, raterId, otherRaterId];
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.leaderboardEntry.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.rating.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.content.deleteMany({ where: { creatorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("saves a review, blocks self-rating and duplicates, and ranks creators", async () => {
    await makeUser(highId, `${prefix}-nova`, {
      verifiedPartnerCount: 10,
      activityPoints: 1000,
      healthVerified: true,
      communityEngagement: 100,
    });
    await makeUser(midId, `${prefix}-jules`, { verifiedPartnerCount: 2, activityPoints: 100 });
    await makeUser(lowId, `${prefix}-rio`);
    await makeUser(raterId, `${prefix}-member`);
    await makeUser(otherRaterId, `${prefix}-guest`);

    const highContent = await prisma.content.create({
      data: { creatorId: highId, title: "Evening set", type: "video", category: "studio", qualityScore: 10 },
    });
    const midContent = await prisma.content.create({
      data: { creatorId: midId, title: "Photo series", type: "photo", category: "studio", qualityScore: 6 },
    });
    const lowContent = await prisma.content.create({
      data: { creatorId: lowId, title: "First clip", type: "video", category: "studio", qualityScore: 3 },
    });

    const rater = { id: raterId, username: `${prefix}-member`, avatarUrl: null, ageVerification: true, verified: true };
    const creator = { id: highId, username: `${prefix}-nova`, avatarUrl: null, ageVerification: true, verified: true };

    await expect(
      createRating(creator, {
        contentId: highContent.id,
        overall: 9,
        feel: 9,
        performance: 9,
        experience: 9,
        userExperience: 9,
        pros: "",
        cons: "",
        review,
        anonymous: false,
      }),
    ).rejects.toMatchObject({ status: 403 });

    const saved = await createRating(rater, {
      contentId: highContent.id,
      overall: 9,
      feel: 10,
      performance: 10,
      experience: 10,
      userExperience: 10,
      pros: "Attentive",
      cons: "",
      review,
      anonymous: false,
    });
    expect(saved.rating.weightedScore).toBe(10);
    expect(saved.content.ratingCount).toBe(1);
    expect(saved.content.ratingAverage).toBe(10);

    await expect(
      createRating(rater, {
        contentId: highContent.id,
        overall: 8,
        feel: 8,
        performance: 8,
        experience: 8,
        userExperience: 8,
        pros: "",
        cons: "",
        review,
        anonymous: false,
      }),
    ).rejects.toMatchObject({ status: 409 });

    const anonymous = await createRating(
      { id: otherRaterId, username: `${prefix}-guest`, avatarUrl: "javascript:alert(1)", ageVerification: true, verified: true },
      {
        contentId: highContent.id,
        overall: 8,
        feel: 8,
        performance: 8,
        experience: 8,
        userExperience: 8,
        pros: "",
        cons: "A bit rushed",
        review,
        anonymous: true,
      },
    );
    expect(anonymous.content.ratingCount).toBe(2);
    expect(anonymous.content.ratingAverage).toBe(9);

    const stored = await prisma.rating.findUniqueOrThrow({
      where: { id: anonymous.rating.id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    expect(presentRater(stored.anonymous, stored.user)).toBeNull();
    expect(presentRater(false, { id: raterId, username: "member", avatarUrl: "javascript:alert(1)" })).toMatchObject({
      avatarUrl: null,
    });

    await createRating(rater, {
      contentId: midContent.id,
      overall: 6,
      feel: 6,
      performance: 6,
      experience: 6,
      userExperience: 6,
      pros: "",
      cons: "",
      review,
      anonymous: false,
    });
    await createRating(rater, {
      contentId: lowContent.id,
      overall: 4,
      feel: 4,
      performance: 4,
      experience: 4,
      userExperience: 4,
      pros: "",
      cons: "",
      review,
      anonymous: false,
    });

    const board = await getLeaderboard({ category: "overall", period: "all", limit: 10 });
    const names = board.rankings.map((row) => row.user.id);
    expect(names.indexOf(highId)).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(highId)).toBeLessThan(names.indexOf(midId));
    expect(names.indexOf(midId)).toBeLessThan(names.indexOf(lowId));
    expect(board.cached).toBe(false);

    const cached = await getLeaderboard({ category: "overall", period: "all", limit: 10 });
    expect(cached.cached).toBe(true);
    expect(cached.rankings[0]?.user.id).toBe(board.rankings[0]?.user.id);

    const photoBoard = await getLeaderboard({ category: "photo", period: "all", limit: 10 });
    expect(photoBoard.rankings.map((row) => row.user.id)).toContain(midId);
    expect(photoBoard.rankings.map((row) => row.user.id)).not.toContain(highId);

    const firstCron = await recalculateAllRankings();
    expect(firstCron.notifications).toBe(0);
    const listed = await prisma.leaderboardEntry.findFirst({
      where: { userId: midId, category: "overall", period: "all" },
    });
    expect(listed?.cronInitialized).toBe(true);

    await prisma.rating.deleteMany({ where: { contentId: midContent.id } });
    await prisma.content.update({ where: { id: midContent.id }, data: { ratingAverage: 0, ratingCount: 0 } });

    const secondCron = await recalculateAllRankings();
    expect(secondCron.notifications).toBeGreaterThan(0);
    const dropped = await prisma.notification.findFirst({
      where: { userId: midId, type: "RANK_CHANGE" },
    });
    expect(dropped?.message).toContain("dropped off");

    const after = await getLeaderboard({ category: "overall", period: "all", limit: 10 });
    expect(after.cached).toBe(false);
    expect(after.rankings.map((row) => row.user.id)).not.toContain(midId);
  });
});
