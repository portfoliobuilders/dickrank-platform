import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo";
import { toErrorResponse } from "@/lib/errors";
import { confirmAge } from "@/lib/profiles";
import { getViewer } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ageVerificationSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = ageVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Confirm that you are 18 or older" }, { status: 400 });
    }

    if (isDemoMode()) {
      const viewer = await getViewer();
      const result = await confirmAge(null, viewer.profile?.id ?? null);
      return NextResponse.json(result);
    }

    const supabase = createSupabaseServerClient();
    const viewer = await getViewer();
    const result = await confirmAge(supabase, viewer.profile?.id ?? null);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
