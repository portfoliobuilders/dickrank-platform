import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { submitDmcaClaim } from "@/lib/dmca";
import { assertSameOrigin, readBody, redirectBack, toErrorResponse, wantsJson } from "@/lib/http";
import { getRequestMeta } from "@/lib/request";
import { dmcaClaimSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = dmcaClaimSchema.parse(await readBody(req));
    const user = await getCurrentUser(req);
    const meta = getRequestMeta(req);
    const result = await submitDmcaClaim({
      contentUrl: body.contentUrl,
      description: body.description,
      contactInfo: body.contactInfo,
      signature: body.signature,
      claimantUserId: user && !user.anonymizedAt ? user.id : null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const payload = {
      id: result.claim.id,
      status: result.claim.status,
      contentHidden: result.contentHidden,
      message: "Your claim is pending review. The content is hidden when we can match it to a post.",
    };
    if (!wantsJson(req)) {
      return redirectBack(req, `/dmca?submitted=${result.claim.id}`);
    }
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (!wantsJson(req)) {
      return redirectBack(req, "/dmca?error=claim");
    }
    return toErrorResponse(error);
  }
}
