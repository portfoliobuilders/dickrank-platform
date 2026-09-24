import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth";
import { isJevAiConfigured, JevAiError, listJevModels } from "@/lib/jev";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Returns only models connected to this Jev account.
 * Use this to populate model selectors (including Laya when connected).
 */
export async function GET() {
  if (!isJevAiConfigured()) {
    return NextResponse.json(
      { error: "Jev AI is not configured", code: "misconfigured" },
      { status: 503 },
    );
  }

  const auth = await requireVerifiedUser();
  if ("error" in auth) return auth.error;

  try {
    const result = await listJevModels();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof JevAiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
        },
        {
          status: error.status >= 400 && error.status < 600 ? error.status : 502,
          headers:
            error.retryAfterSeconds !== undefined
              ? { "Retry-After": String(error.retryAfterSeconds) }
              : undefined,
        },
      );
    }
    console.error("jev models failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
