import { NextResponse } from 'next/server';
import { writeAudit } from '@/lib/audit';
import { hashLookup, secretsMatch } from '@/lib/encryption';
import { emailTemplates, sendResendEmail } from '@/lib/email';
import { HttpError } from '@/lib/errors';
import { clientIpHash, withApi } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { emailCodeSchema } from '@/lib/validations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(async (request) => {
  const ipHash = clientIpHash(request);
  if (!rateLimit(`email-code:${ipHash ?? 'unknown'}`, 10, 60 * 60 * 1000)) {
    throw new HttpError('Too many attempts. Try again later.', 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError('Enter the 6-digit code.', 400);
  }
  const parsed = emailCodeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code.', 400);
  }

  const prisma = getPrisma();
  const account = await prisma.user.findUnique({
    where: { emailHash: hashLookup(parsed.data.email.toLowerCase()) },
  });
  const expired = !account?.emailCodeExpires || account.emailCodeExpires.getTime() < Date.now();
  const codeHash = hashLookup(parsed.data.code);
  const matches = Boolean(account?.emailCodeHash) && secretsMatch(account?.emailCodeHash ?? '', codeHash);
  if (!account || expired || !matches) {
    throw new HttpError('That code is wrong or expired.', 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: account.id },
      data: {
        emailVerifiedAt: new Date(),
        emailCodeHash: null,
        emailCodeExpires: null,
      },
    });
    await writeAudit(tx, {
      actorId: account.id,
      action: 'update',
      entityType: 'user',
      entityId: account.id,
      metadata: { result: 'email_verified' },
      ipHash,
    });
  });

  const welcome = emailTemplates.welcome(account.username);
  try {
    await sendResendEmail({
      to: parsed.data.email.toLowerCase(),
      subject: welcome.subject,
      html: welcome.html,
    });
  } catch (error) {
    console.error('welcome email failed', error);
  }

  return NextResponse.json({ emailVerified: true });
});
