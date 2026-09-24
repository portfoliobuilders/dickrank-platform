import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { requireVerifiedUser } from "@/lib/auth";
import {
  evaluateSystemOne,
  isJevAiConfigured,
  JevAiError,
  jevEvaluateRequestSchema,
  jevSavedJudgeRequestSchema,
} from "@/lib/jev";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isJevAiConfigured()) {
    return NextResponse.json(
      { error: "Jev AI is not configured", code: "misconfigured" },
      { status: 503 },
    );
  }

  const auth = await requireVerifiedUser();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const withQuestions = jevEvaluateRequestSchema.safeParse(body);
  if (withQuestions.success) {
    return runEvaluate(auth.profile.id, withQuestions.data);
  }

  const withJudge = jevSavedJudgeRequestSchema.safeParse(body);
  if (!withJudge.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: withQuestions.error.flatten(),
      },
      { status: 400 },
    );
  }

  return runEvaluate(auth.profile.id, withJudge.data);
}

async function runEvaluate(
  actorId: string,
  input: Parameters<typeof evaluateSystemOne>[0],
) {
  try {
    const result = await evaluateSystemOne(input);

    await writeAuditLog({
      actorId,
      action: "jev.evaluate",
      entity: "jev",
      metadata: {
        model: result.model,
        questionIds: Object.keys(result.answers).join(","),
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.flatten() },
        { status: 400 },
      );
    }
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
    console.error("jev evaluate failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
