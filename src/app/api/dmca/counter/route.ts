import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { submitCounterNotice } from "@/lib/dmca";
import { assertSameOrigin, HttpError, readBody, redirectBack, toErrorResponse, wantsJson } from "@/lib/http";
import { getRequestMeta } from "@/lib/request";
import { dmcaCounterSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    if (!user.ageVerified) {
      throw new HttpError(403, "Age verification is required before acting on content");
    }
    const body = dmcaCounterSchema.parse(await readBody(req));
    const meta = getRequestMeta(req);
    const updated = await submitCounterNotice({
      claimId: body.claimId,
      statement: body.statement,
      contactInfo: body.contactInfo,
      ownerId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    const payload = {
      id: updated.id,
      status: updated.status,
      restoreAt: updated.restoreAt?.toISOString() ?? null,
      message: "Counter-notice received. The content stays hidden for 10 days unless a lawsuit is recorded, then it is restored.",
    };
    if (!wantsJson(req)) {
      return redirectBack(req, `/dmca?counter=${updated.id}`);
    }
    return NextResponse.json(payload);
  } catch (error) {
    if (!wantsJson(req)) {
      return redirectBack(req, "/dmca?error=counter");
    }
    return toErrorResponse(error);
  }
}
