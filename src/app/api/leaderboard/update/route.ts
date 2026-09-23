import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import { recalculateAllRankings } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "This job is not authorized." }, { status: 401 });
  }

  try {
    const result = await recalculateAllRankings();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Failed to recalculate rankings.", error);
    return NextResponse.json({ error: "Rankings could not be updated." }, { status: 500 });
  }
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
