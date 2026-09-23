import { NextResponse } from "next/server";

import { presentRater } from "@/lib/present-rating";
import { prisma } from "@/lib/prisma";
import { ratingsListQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { contentId: string } }) {
  try {
    const contentId = params.contentId?.trim();
    if (!contentId || contentId.length > 128) {
      return NextResponse.json({ error: "That content could not be found." }, { status: 404 });
    }

    const query = ratingsListQuerySchema.safeParse({
      page: new URL(request.url).searchParams.get("page") ?? undefined,
      limit: new URL(request.url).searchParams.get("limit") ?? undefined,
    });
    if (!query.success) {
      return NextResponse.json(
        { error: "Check the page and limit.", fieldErrors: query.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, ratingAverage: true, ratingCount: true },
    });
    if (!content) {
      return NextResponse.json({ error: "That content could not be found." }, { status: 404 });
    }

    const { page, limit } = query.data;
    const [total, ratings] = await Promise.all([
      prisma.rating.count({ where: { contentId } }),
      prisma.rating.findMany({
        where: { contentId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
      }),
    ]);

    return NextResponse.json({
      content,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      ratings: ratings.map((rating) => ({
        id: rating.id,
        overall: rating.overall,
        feel: rating.feel,
        performance: rating.performance,
        experience: rating.experience,
        userExperience: rating.userExperience,
        weightedScore: rating.weightedScore,
        pros: rating.pros,
        cons: rating.cons,
        review: rating.review,
        anonymous: rating.anonymous,
        createdAt: rating.createdAt.toISOString(),
        rater: presentRater(rating.anonymous, rating.user),
      })),
    });
  } catch (error) {
    console.error("Failed to load ratings.", error);
    return NextResponse.json({ error: "Reviews could not be loaded." }, { status: 500 });
  }
}
