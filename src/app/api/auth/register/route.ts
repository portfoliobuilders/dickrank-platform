import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { encryptString, generateNumericCode, hashEmail, hashVerificationCode } from "@/lib/crypto";
import { sendVerificationCode, verificationExpiry } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { registerSchema, toPublicUser } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the form and try again", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const username = parsed.data.username;
  const emailHash = hashEmail(email);

  const [emailOwner, usernameOwner] = await Promise.all([
    prisma.user.findUnique({ where: { emailHash }, select: { id: true } }),
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
  ]);

  if (emailOwner) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }
  if (usernameOwner) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  const code = generateNumericCode();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          emailHash,
          emailEncrypted: encryptString(email),
          username,
          passwordHash,
          verificationStatus: "PENDING",
          ageVerified: false,
          emailVerificationHash: hashVerificationCode(code),
          emailVerificationExpires: verificationExpiry(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: created.id,
          action: "user_register",
          metadata: JSON.stringify({ verificationStatus: "PENDING" }),
        },
      });
      return created;
    });

    try {
      await sendVerificationCode(email, code);
    } catch {
      return NextResponse.json(
        { error: "Account was created, but the verification email could not be sent" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        user: toPublicUser({
          id: user.id,
          email,
          username: user.username,
          verificationStatus: user.verificationStatus,
          ageVerified: user.ageVerified,
          emailVerified: user.emailVerified,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email or username is already registered" }, { status: 409 });
    }
    console.error("register failed");
    return NextResponse.json({ error: "Could not create the account" }, { status: 500 });
  }
}
