import { NextResponse } from "next/server";
import { z } from "zod";
import { buildHealthReport } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const healthQuerySchema = z.object({
  verbose: z.enum(["0", "1"]).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = healthQuerySchema.safeParse({
    verbose: url.searchParams.get("verbose") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ status: "error", error: "Invalid query" }, { status: 400 });
  }

  const report = buildHealthReport(process.env);
  const body =
    parsed.data.verbose === "1"
      ? report
      : {
          status: report.status,
          ready: report.ready,
          service: report.service,
          timestamp: report.timestamp,
        };

  return NextResponse.json(body, {
    status: report.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
