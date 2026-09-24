import { NextResponse } from 'next/server';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/audit';
import { requireVerifiedUser } from '@/lib/auth';
import {
  extractVideoThumbnail,
  processImage,
  storeOriginalVideo,
  type ProcessContentType,
  type ProcessImageResult,
} from '@/lib/image-processing';
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES, validateUploadFile } from '@/lib/uploadLimits';
import { rateLimit } from '@/lib/rate-limit';
import { scanBuffer } from '@/lib/virus-scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const contentTypeSchema = z.enum(['avatar', 'thumbnail', 'content']);

const formMetaSchema = z.object({
  contentType: contentTypeSchema,
});

type ProcessSuccess = ProcessImageResult & {
  videoKey?: string;
  videoUrl?: string;
  videoByteSize?: number;
};

export async function POST(req: Request) {
  const auth = await requireVerifiedUser();
  if ('error' in auth) {
    return auth.error;
  }

  // Age gate is enforced inside requireVerifiedUser (age_verified must be true).
  const userId = auth.profile.id;

  if (!rateLimit(`upload-process:${userId}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Upload limit reached. Try again later.' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const parsedMeta = formMetaSchema.safeParse({
    contentType: formData.get('contentType'),
  });
  if (!parsedMeta.success) {
    return NextResponse.json(
      { error: 'contentType must be avatar, thumbnail, or content.' },
      { status: 400 },
    );
  }
  const purpose: ProcessContentType = parsedMeta.data.contentType;

  if (file.size <= 0) {
    return NextResponse.json({ error: 'That file is empty.' }, { status: 400 });
  }

  const sizeProblem = validateUploadFile(file.type, file.size);
  if (sizeProblem) {
    return NextResponse.json({ error: sizeProblem }, { status: 400 });
  }

  const maxBytes = file.type.startsWith('video/') ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: 'File is too large.' }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const verdict = await scanBuffer(buffer, file.name || 'upload', file.type);

    if (verdict.status !== 'CLEAN' || !verdict.media) {
      await writeAuditLog({
        actorId: userId,
        action: 'upload.process',
        entity: 'media',
        metadata: {
          result: verdict.status.toLowerCase(),
          purpose,
          engine: verdict.engine,
        },
      });
      if (verdict.status === 'FAILED') {
        return NextResponse.json(
          { error: 'Virus scan is unavailable. Nothing was saved.' },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: 'That file was rejected by the virus scan.' },
        { status: 422 },
      );
    }

    let result: ProcessSuccess;

    if (verdict.media.mediaType === 'IMAGE') {
      result = await processImage({
        buffer,
        filename: file.name,
        userId,
        contentType: purpose,
        watermark: purpose === 'content',
      });
    } else if (verdict.media.mediaType === 'VIDEO') {
      const thumbnailBuffer = await extractVideoThumbnail(buffer);
      const thumb = await processImage({
        buffer: thumbnailBuffer,
        filename: 'video-thumbnail.jpg',
        userId,
        contentType: 'thumbnail',
        watermark: false,
      });

      const video = await storeOriginalVideo({
        buffer,
        userId,
        ext: verdict.media.ext,
        mimeType: verdict.media.mime,
      });

      result = {
        ...thumb,
        videoKey: video.key,
        videoUrl: video.url,
        videoByteSize: video.byteSize,
      };
    } else {
      return NextResponse.json({ error: 'Unsupported media type.' }, { status: 400 });
    }

    await writeAuditLog({
      actorId: userId,
      action: 'upload.process',
      entity: 'media',
      entityId: result.key,
      metadata: {
        purpose,
        mimeType: result.mimeType,
        byteSize: result.byteSize,
        mediaType: verdict.media.mediaType,
        videoKey: result.videoKey ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Process upload error:', error);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}
