import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { writeAudit } from '@/lib/audit';
import { encryptPii, hashLookup } from '@/lib/encryption';
import { HttpError, isUniqueConstraint } from '@/lib/errors';
import { clientIpHash, withApi } from '@/lib/http';
import { hashPassword } from '@/lib/passwords';
import { getPrisma } from '@/lib/prisma';
import { toPublicUser } from '@/lib/public-user';
import { rateLimit } from '@/lib/rate-limit';
import { registerSchema } from '@/lib/validations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function issueCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export const POST = withApi(async (request) => {
  if (!rateLimit(`register:${clientIpHash(request) ?? 'unknown'}`, 8, 60 * 60 * 1000)) {
    throw new HttpError('Too many attempts. Try again later.', 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError('Check the form and try again.', 400);
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(parsed.error.issues[0]?.message ?? 'Check the form and try again.', 400);
  }

  const email = parsed.data.email.toLowerCase();
  const username = parsed.data.username.toLowerCase();
  const emailHash = hashLookup(email);
  const prisma = getPrisma();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ emailHash }, { username }] },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError('An account with that email or username already exists.', 409);
  }

  const code = issueCode();
  const passwordHash = await hashPassword(parsed.data.password);
  const ipHash = clientIpHash(request);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          passwordHash,
          emailEncrypted: encryptPii(email),
          emailHash,
          verificationStatus: 'PENDING',
          ageVerification: false,
          emailCodeHash: hashLookup(code),
          emailCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
          profile: { create: { displayName: username } },
        },
      });
      await writeAudit(tx, {
        actorId: created.id,
        action: 'create',
        entityType: 'user',
        entityId: created.id,
        ipHash,
      });
      return created;
    });

    return NextResponse.json({
      user: toPublicUser(user),
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new HttpError('An account with that email or username already exists.', 409);
    }
    throw error;
  }
});
