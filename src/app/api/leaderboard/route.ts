import { NextResponse } from "next/server";

import { getLeaderboard } from "@/lib/leaderboard";
import { leaderboardQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = leaderboardQuerySchema.safeParse({
    category: params.get("category") ?? undefined,
    period: params.get("period") ?? undefined,
    limit: params.get("limit") ?? undefined,
    type: params.get("type") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the leaderboard filters.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const board = await getLeaderboard(parsed.data);
    return NextResponse.json(board);
  } catch (error) {
    console.error("Failed to calculate the leaderboard.", error);
    return NextResponse.json({ error: "Rankings are temporarily unavailable." }, { status: 503 });
  }
}
