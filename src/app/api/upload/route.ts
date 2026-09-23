import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { writeAudit } from '@/lib/audit';
import { requireVerifiedUser } from '@/lib/auth';
import { clientIpHash, withApi } from '@/lib/http';
import { MAX_UPLOAD_BYTES } from '@/lib/media-policy';
import { getPrisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { deleteUpload, mediaKeyFor, storeUpload } from '@/lib/storage';
import { uploadSchema } from '@/lib/validations';
import { scanBuffer } from '@/lib/virus-scan';
import type { UploadResponse } from '@/types';
import { HttpError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = withApi(async (request) => {
  const account = await requireVerifiedUser();
  if (account.ageVerification !== true) {
    throw new HttpError('Age verification required', 403, 'AGE_VERIFICATION');
  }
  if (!rateLimit(`upload:${account.id}`, 10, 60 * 60 * 1000)) {
    throw new HttpError('Upload limit reached. Try again later.', 429);
  }

  const form = await request.formData();
  const description = form.get('description');
  const parsed = uploadSchema.parse({
    title: form.get('title'),
    description: typeof description === 'string' ? description : undefined,
    visibility: form.get('visibility'),
    confirmAdultSubjects: form.get('confirmAdultSubjects') === 'true',
    confirmRights: form.get('confirmRights') === 'true',
  });

  const incoming = form.get('file');
  if (!(incoming instanceof File)) throw new HttpError('Choose a file to upload', 400);
  if (incoming.size <= 0) throw new HttpError('That file is empty', 400);
  if (incoming.size > MAX_UPLOAD_BYTES) throw new HttpError('File is larger than 8 MB', 413);

  const buffer = Buffer.from(await incoming.arrayBuffer());
  const verdict = await scanBuffer(buffer, incoming.name || 'upload', incoming.type);
  const ipHash = clientIpHash(request);

  if (verdict.status !== 'CLEAN' || !verdict.media) {
    await getPrisma().$transaction(async (tx) => {
      await writeAudit(tx, {
        actorId: account.id,
        action: 'upload',
        entityType: 'content',
        metadata: {
          result: verdict.status.toLowerCase(),
          engine: verdict.engine,
        },
        ipHash,
      });
    });
    if (verdict.status === 'FAILED') {
      throw new HttpError('Virus scan is unavailable. Nothing was saved.', 503);
    }
    throw new HttpError('That file was rejected by the virus scan.', 422);
  }

  const media = verdict.media;
  const key = mediaKeyFor(account.id, `${randomUUID()}.${media.ext}`);
  await storeUpload(key, buffer, media.mime);

  try {
    const content = await getPrisma().$transaction(async (tx) => {
      const created = await tx.content.create({
        data: {
          creatorId: account.id,
          title: parsed.title,
          description: parsed.description,
          mediaKey: key,
          mimeType: media.mime,
          mediaType: media.mediaType,
          byteSize: buffer.length,
          scanStatus: 'CLEAN',
          scanDetails: verdict.details.slice(0, 200),
          visibility: parsed.visibility,
        },
      });
      await writeAudit(tx, {
        actorId: account.id,
        action: 'upload',
        entityType: 'content',
        entityId: created.id,
        metadata: {
          visibility: parsed.visibility,
          mediaType: media.mediaType,
          byteSize: buffer.length,
          engine: verdict.engine,
        },
        ipHash,
      });
      return created;
    });

    const body: UploadResponse = {
      content: {
        id: content.id,
        title: content.title,
        scanStatus: content.scanStatus,
        mediaPath: `/api/media/${content.mediaKey}`,
        visibility: content.visibility,
      },
    };
    return NextResponse.json(body);
  } catch (error) {
    await deleteUpload(key);
    throw error;
  }
});
