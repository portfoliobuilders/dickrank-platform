import { NextResponse } from "next/server";

import { HttpError, requireVerifiedRater } from "@/lib/auth";
import { createRating } from "@/lib/create-rating";
import { createRatingSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedRater(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Send the review as JSON." }, { status: 400 });
    }

    const parsed = createRatingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Check the review and try again.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const saved = await createRating(user, parsed.data);
    return NextResponse.json(
      {
        rating: {
          id: saved.rating.id,
          contentId: saved.rating.contentId,
          overall: saved.rating.overall,
          feel: saved.rating.feel,
          performance: saved.rating.performance,
          experience: saved.rating.experience,
          userExperience: saved.rating.userExperience,
          weightedScore: saved.rating.weightedScore,
          pros: saved.rating.pros,
          cons: saved.rating.cons,
          review: saved.rating.review,
          anonymous: saved.rating.anonymous,
          createdAt: saved.rating.createdAt.toISOString(),
        },
        content: saved.content,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, ...(error.status === 409 ? { duplicate: true } : {}) },
        { status: error.status },
      );
    }
    console.error("Failed to create rating.", error);
    return NextResponse.json({ error: "The review could not be saved." }, { status: 500 });
  }
}
