import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getContent, getContentPreview, resolveContentAccess } from "@/lib/content-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(_request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) {
    return NextResponse.json({ hasAccess: false, reason: "invalid_id" }, { status: 400 });
  }

  try {
    const content = await getContent(params.data.id);
    if (!content) {
      return NextResponse.json({ hasAccess: false, reason: "not_found" }, { status: 404 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ hasAccess: false, reason: "unauthenticated" }, { status: 401 });
    }
    if (!user.ageVerified) {
      return NextResponse.json({ hasAccess: false, reason: "age_verification_required" }, { status: 403 });
    }

    const decision = await resolveContentAccess({
      userId: user.id,
      ageVerified: true,
      content,
    });

    if (!decision.hasAccess) {
      const preview = await getContentPreview(content);
      return NextResponse.json({
        hasAccess: false,
        reason: decision.reason,
        preview,
      });
    }

    return NextResponse.json({ hasAccess: true, reason: decision.reason });
  } catch (error) {
    console.error("content access check failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ hasAccess: false, reason: "unavailable" }, { status: 500 });
  }
}
