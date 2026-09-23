import { NextResponse } from "next/server";
import { toggleLike } from "@/lib/content";
import { toErrorResponse } from "@/lib/errors";
import { requireVerifiedUser } from "@/lib/session";
import { contentIdSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = contentIdSchema.safeParse(params.id);
    if (!id.success) return NextResponse.json({ error: "Invalid content id" }, { status: 400 });
    const auth = await requireVerifiedUser();
    const result = await toggleLike(auth.supabase, auth.profile, id.data);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
