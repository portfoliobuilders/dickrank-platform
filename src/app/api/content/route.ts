import { NextResponse } from "next/server";
import { createContent, listContent } from "@/lib/content";
import { toErrorResponse } from "@/lib/errors";
import { requireCreator, requireVerifiedUser } from "@/lib/session";
import { createContentSchema, listContentQuerySchema, parseTagParam } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireVerifiedUser();
    const url = new URL(request.url);
    const parsed = listContentQuerySchema.safeParse({
      category: url.searchParams.get("category") || undefined,
      tags: parseTagParam(url.searchParams.get("tags")),
      sort: url.searchParams.get("sort") || undefined,
      page: url.searchParams.get("page") || undefined,
      feed: url.searchParams.get("feed") || undefined,
      creator: url.searchParams.get("creator") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search parameters", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const result = await listContent(auth.supabase, auth.profile, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireCreator();
    const body = await request.json().catch(() => null);
    const parsed = createContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid content", issues: parsed.error.flatten() }, { status: 400 });
    }
    const content = await createContent(auth.supabase, auth.profile, parsed.data);
    return NextResponse.json(content, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
