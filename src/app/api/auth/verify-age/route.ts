import { NextResponse } from 'next/server';
import { writeAudit } from '@/lib/audit';
import { requireAccount } from '@/lib/auth';
import { encryptPii } from '@/lib/encryption';
import { HttpError } from '@/lib/errors';
import { clientIpHash, withApi } from '@/lib/http';
import { deleteIdentityKeys, saveEncryptedIdentity } from '@/lib/identity-store';
import { getPrisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { scanBuffer } from '@/lib/virus-scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_ID_BYTES = 4 * 1024 * 1024;

async function readImage(form: FormData, field: string) {
  const incoming = form.get(field);
  if (!(incoming instanceof File)) {
    throw new HttpError('Upload the front, back, and a live selfie.', 400);
  }
  if (incoming.size <= 0) throw new HttpError('One of those photos is empty.', 400);
  if (incoming.size > MAX_ID_BYTES) throw new HttpError('Each photo must be 4 MB or smaller.', 413);
  const buffer = Buffer.from(await incoming.arrayBuffer());
  const verdict = await scanBuffer(buffer, incoming.name || `${field}.jpg`, incoming.type);
  if (verdict.status === 'FAILED') {
    throw new HttpError('Virus scan is unavailable. Nothing was saved.', 503);
  }
  if (verdict.status !== 'CLEAN' || verdict.media?.mediaType !== 'IMAGE') {
    throw new HttpError('That file was rejected. Use a photo of the ID.', 422);
  }
  return buffer;
}

export const POST = withApi(async (request) => {
  const account = await requireAccount();
  if (!rateLimit(`verify-age:${account.id}`, 5, 24 * 60 * 60 * 1000)) {
    throw new HttpError('Too many uploads. Try again tomorrow.', 429);
  }
  if (!account.emailVerifiedAt) {
    throw new HttpError('Confirm your email before sending an ID.', 403);
  }
  if (account.ageVerification === true) {
    throw new HttpError('This account is already age verified.', 400);
  }

  const pending = await getPrisma().reviewQueue.findFirst({
    where: { userId: account.id, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) {
    throw new HttpError('Your ID is already waiting for review.', 409);
  }

  const form = await request.formData();
  const files = {
    front: await readImage(form, 'front'),
    back: await readImage(form, 'back'),
    selfie: await readImage(form, 'selfie'),
  };

  const stored: string[] = [];
  try {
    const keys = {
      front: await saveEncryptedIdentity(account.id, 'front', files.front),
      back: await saveEncryptedIdentity(account.id, 'back', files.back),
      selfie: await saveEncryptedIdentity(account.id, 'selfie', files.selfie),
    };
    stored.push(keys.front, keys.back, keys.selfie);

    await getPrisma().$transaction(async (tx) => {
      const stillPending = await tx.reviewQueue.findFirst({
        where: { userId: account.id, status: 'PENDING' },
        select: { id: true },
      });
      if (stillPending) throw new HttpError('Your ID is already waiting for review.', 409);

      await tx.reviewQueue.create({
        data: {
          userId: account.id,
          status: 'PENDING',
          frontDocumentEncrypted: encryptPii(keys.front),
          backDocumentEncrypted: encryptPii(keys.back),
          selfieEncrypted: encryptPii(keys.selfie),
        },
      });
      await tx.user.update({
        where: { id: account.id },
        data: {
          verificationStatus: 'PENDING',
          ageVerification: false,
          idDocumentEncrypted: encryptPii(keys.front),
        },
      });
      await writeAudit(tx, {
        actorId: account.id,
        action: 'upload',
        entityType: 'review_queue',
        entityId: account.id,
        metadata: { result: 'queued' },
        ipHash: clientIpHash(request),
      });
    });
  } catch (error) {
    await deleteIdentityKeys(stored);
    throw error;
  }

  return NextResponse.json({
    verificationStatus: 'PENDING',
    ageVerification: false,
    queued: true,
  });
});
