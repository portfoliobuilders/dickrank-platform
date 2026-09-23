import { NextResponse } from 'next/server';
import { writeAudit } from '@/lib/audit';
import { hashLookup, secretsMatch } from '@/lib/encryption';
import { HttpError } from '@/lib/errors';
import { clientIpHash, withApi } from '@/lib/http';
import { hashPassword } from '@/lib/passwords';
import { getPrisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { resetPasswordSchema } from '@/lib/validations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(async (request) => {
  const ipHash = clientIpHash(request);
  if (!rateLimit(`reset:${ipHash ?? 'unknown'}`, 8, 60 * 60 * 1000)) {
    throw new HttpError('Too many attempts. Try again later.', 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError('Check the form and try again.', 400);
  }
  const parsed = resetPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(parsed.error.issues[0]?.message ?? 'Check the form and try again.', 400);
  }

  const tokenHash = hashLookup(parsed.data.token);
  const accounts = await getPrisma().user.findMany({
    where: { resetTokenExpires: { gt: new Date() } },
    select: { id: true, resetTokenHash: true },
  });
  const account = accounts.find(
    (row) => row.resetTokenHash && secretsMatch(row.resetTokenHash, tokenHash),
  );
  if (!account) throw new HttpError('That reset link is wrong or expired.', 400);

  const passwordHash = await hashPassword(parsed.data.password);
  await getPrisma().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: account.id },
      data: { passwordHash, resetTokenHash: null, resetTokenExpires: null },
    });
    await writeAudit(tx, {
      actorId: account.id,
      action: 'update',
      entityType: 'user',
      entityId: account.id,
      metadata: { result: 'password_reset' },
      ipHash,
    });
  });

  return NextResponse.json({ ok: true });
});