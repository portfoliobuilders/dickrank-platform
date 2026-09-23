import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { reviewDmcaClaim } from "@/lib/dmca";
import { assertSameOrigin, readBody, redirectBack, toErrorResponse, wantsJson } from "@/lib/http";
import { getRequestMeta } from "@/lib/request";
import { dmcaReviewSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin(req);
    const body = dmcaReviewSchema.parse(await readBody(req));
    const meta = getRequestMeta(req);
    const updated = await reviewDmcaClaim({
      claimId: body.claimId,
      decision: body.decision,
      reviewerId: admin.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    if (!wantsJson(req)) {
      return redirectBack(req, `/claims?status=${updated.status}&updated=1`);
    }
    return NextResponse.json({ id: updated.id, status: updated.status, lawsuitFiled: updated.lawsuitFiled });
  } catch (error) {
    if (!wantsJson(req)) {
      return redirectBack(req, "/claims?error=review");
    }
    return toErrorResponse(error);
  }
}
