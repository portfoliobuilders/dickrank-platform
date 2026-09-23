import { NextRequest, NextResponse } from "next/server";
import { runRetentionJobs } from "@/lib/gdpr";
import { jsonError, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const header = req.headers.get("authorization");
    if (!secret || header !== `Bearer ${secret}`) {
      return jsonError(401, "Unauthorized");
    }
    const result = await runRetentionJobs();
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
