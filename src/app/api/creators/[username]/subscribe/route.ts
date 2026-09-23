import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { toggleSubscription } from "@/lib/profiles";
import { requireVerifiedUser } from "@/lib/session";
import { usernameSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { username: string } }) {
  try {
    const username = usernameSchema.safeParse(params.username);
    if (!username.success) return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    const auth = await requireVerifiedUser();
    const result = await toggleSubscription(auth.supabase, auth.profile, username.data);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
