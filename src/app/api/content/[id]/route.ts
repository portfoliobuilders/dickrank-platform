import { NextResponse } from "next/server";
import { getContent, softDeleteContent, updateContent } from "@/lib/content";
import { toErrorResponse } from "@/lib/errors";
import { requireCreator, requireVerifiedUser } from "@/lib/session";
import { contentIdSchema, updateContentSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  try {
    const id = contentIdSchema.safeParse(params.id);
    if (!id.success) return NextResponse.json({ error: "Invalid content id" }, { status: 400 });
    const auth = await requireVerifiedUser();
    const result = await getContent(auth.supabase, auth.profile, id.data);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const id = contentIdSchema.safeParse(params.id);
    if (!id.success) return NextResponse.json({ error: "Invalid content id" }, { status: 400 });
    const auth = await requireCreator();
    const body = await request.json().catch(() => null);
    const parsed = updateContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid content", issues: parsed.error.flatten() }, { status: 400 });
    }
    const content = await updateContent(auth.supabase, auth.profile, id.data, parsed.data);
    return NextResponse.json(content);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const id = contentIdSchema.safeParse(params.id);
    if (!id.success) return NextResponse.json({ error: "Invalid content id" }, { status: 400 });
    const auth = await requireCreator();
    const result = await softDeleteContent(auth.supabase, auth.profile, id.data);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
