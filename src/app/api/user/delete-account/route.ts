import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { scheduleAccountDeletion } from "@/lib/gdpr";
import { assertSameOrigin, readBody, toErrorResponse } from "@/lib/http";
import { getRequestMeta } from "@/lib/request";
import { retentionPolicyText } from "@/lib/retention";
import { deleteAccountSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const body = deleteAccountSchema.parse(await readBody(req));
    const meta = getRequestMeta(req);
    const result = await scheduleAccountDeletion({
      userId: user.id,
      confirmation: body.confirmation,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (result.status === "cancelled") {
      return NextResponse.json({ status: "cancelled", message: "Account deletion was cancelled." });
    }

    return NextResponse.json({
      status: "scheduled",
      deletionExecuteAt: result.deletionExecuteAt?.toISOString() ?? null,
      message: "Your account is scheduled for permanent deletion in 30 days. Submit CANCEL before that date to stop it.",
      retention: retentionPolicyText(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
