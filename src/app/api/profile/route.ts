import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { getOwnProfile, updateOwnProfile } from "@/lib/profiles";
import { requireVerifiedUser } from "@/lib/session";
import { updateProfileSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireVerifiedUser();
    const profile = await getOwnProfile(auth.supabase, auth.profile);
    return NextResponse.json(profile);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireVerifiedUser();
    const body = await request.json().catch(() => null);
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile", issues: parsed.error.flatten() }, { status: 400 });
    }
    const profile = await updateOwnProfile(auth.supabase, auth.profile, parsed.data);
    return NextResponse.json(profile);
  } catch (error) {
    return toErrorResponse(error);
  }
}
