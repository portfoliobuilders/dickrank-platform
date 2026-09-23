import { NextResponse } from "next/server";
import { reportContent } from "@/lib/content";
import { toErrorResponse } from "@/lib/errors";
import { requireVerifiedUser } from "@/lib/session";
import { contentIdSchema, reportSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = contentIdSchema.safeParse(params.id);
    if (!id.success) return NextResponse.json({ error: "Invalid content id" }, { status: 400 });
    const auth = await requireVerifiedUser();
    const body = await request.json().catch(() => null);
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid report", issues: parsed.error.flatten() }, { status: 400 });
    }
    const result = await reportContent(auth.supabase, auth.profile, id.data, parsed.data.reason, parsed.data.details);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
