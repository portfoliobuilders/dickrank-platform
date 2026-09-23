import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { writeAudit } from '@/lib/audit';
import { hashLookup } from '@/lib/encryption';
import { clientIpHash, withApi } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { forgotPasswordSchema } from '@/lib/validations';
import { HttpError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(async (request) => {
  const ipHash = clientIpHash(request);
  if (!rateLimit(`forgot:${ipHash ?? 'unknown'}`, 8, 60 * 60 * 1000)) {
    throw new HttpError('Too many attempts. Try again later.', 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError('Enter a valid email.', 400);
  }
  const parsed = forgotPasswordSchema.safeParse(payload);
  if (!parsed.success) throw new HttpError('Enter a valid email.', 400);

  const token = randomBytes(32).toString('hex');
  const account = await getPrisma().user.findUnique({
    where: { emailHash: hashLookup(parsed.data.email.toLowerCase()) },
    select: { id: true },
  });

  if (account) {
    await getPrisma().$transaction(async (tx) => {
      await tx.user.update({
        where: { id: account.id },
        data: {
          resetTokenHash: hashLookup(token),
          resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      await writeAudit(tx, {
        actorId: account.id,
        action: 'update',
        entityType: 'user',
        entityId: account.id,
        metadata: { result: 'reset_requested' },
        ipHash,
      });
    });
  }

  return NextResponse.json({
    ok: true,
    ...(account && process.env.NODE_ENV !== 'production' ? { devToken: token } : {}),
  });
});
