import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { decryptString, generateNumericCode, hashEmail, hashVerificationCode, verificationCodesMatch } from "@/lib/crypto";
import { sendVerificationCode, verificationExpiry } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { emailCodeSchema, resendCodeSchema } from "@/lib/schemas";

export const runtime = "nodejs";

const bodySchema = z.union([
  emailCodeSchema.extend({ intent: z.literal("confirm").optional() }),
  resendCodeSchema.extend({ intent: z.literal("resend") }),
]);

const attempts = new Map<string, { count: number; resetAt: number }>();

function tooManyAttempts(emailHash: string): boolean {
  const now = Date.now();
  const current = attempts.get(emailHash);
  if (!current || current.resetAt < now) {
    attempts.set(emailHash, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > 8;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the code and try again", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const emailHash = hashEmail(email);

  if (parsed.data.intent === "resend") {
    const user = await prisma.user.findUnique({ where: { emailHash } });
    if (user && !user.emailVerified) {
      const code = generateNumericCode();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationHash: hashVerificationCode(code),
          emailVerificationExpires: verificationExpiry(),
        },
      });
      try {
        await sendVerificationCode(decryptString(user.emailEncrypted), code);
      } catch {
        return NextResponse.json({ error: "Could not send a verification email" }, { status: 503 });
      }
      await writeAuditLog({ userId: user.id, action: "email_verification_resent" });
    }
    return NextResponse.json({ ok: true });
  }

  if (tooManyAttempts(emailHash)) {
    return NextResponse.json({ error: "Too many attempts. Request a new code in a few minutes." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { emailHash } });
  if (!user || !user.emailVerificationHash || !user.emailVerificationExpires) {
    return NextResponse.json({ error: "That code is invalid or expired" }, { status: 400 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ verified: true });
  }

  const expired = user.emailVerificationExpires.getTime() < Date.now();
  const matches = verificationCodesMatch(parsed.data.code, user.emailVerificationHash);
  if (expired || !matches) {
    return NextResponse.json({ error: "That code is invalid or expired" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      emailVerificationHash: null,
      emailVerificationExpires: null,
    },
  });
  await writeAuditLog({ userId: user.id, action: "email_verified" });

  return NextResponse.json({ verified: true });
}
