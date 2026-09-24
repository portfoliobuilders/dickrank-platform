import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { mediaKeyFor, storeUpload } from '@/lib/storage';

export type ProcessContentType = 'avatar' | 'thumbnail' | 'content';

export type ProcessImageInput = {
  buffer: Buffer;
  filename: string;
  userId: string;
  contentType: ProcessContentType;
  watermark?: boolean;
};

export type ProcessImageResult = {
  key: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  contentType: ProcessContentType;
};

const AVATAR_SIZE = 256;
const THUMBNAIL_WIDTH = 640;
const CONTENT_MAX_WIDTH = 1920;
const JPEG_QUALITY = 82;

/** Storage keys only allow alphanumeric owner ids (no UUID hyphens). */
function storageOwnerId(userId: string): string {
  const cleaned = userId.replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) {
    throw new Error('Invalid user id for media storage');
  }
  return cleaned;
}

function watermarkSvg(width: number, height: number): Buffer {
  const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.045));
  const padding = Math.round(fontSize * 0.6);
  const label = 'DickRank';
  const boxWidth = Math.round(fontSize * label.length * 0.62 + padding * 2);
  const boxHeight = Math.round(fontSize + padding * 1.4);
  const x = Math.max(padding, width - boxWidth - padding);
  const y = Math.max(padding, height - boxHeight - padding);

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="6" fill="rgba(0,0,0,0.45)"/>
      <text x="${x + padding}" y="${y + boxHeight - padding * 0.75}" fill="rgba(255,255,255,0.92)"
        font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600">${label}</text>
    </svg>`,
  );
}

function resizeForPurpose(image: ReturnType<typeof sharp>, contentType: ProcessContentType): ReturnType<typeof sharp> {
  if (contentType === 'avatar') {
    return image.resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' });
  }
  if (contentType === 'thumbnail') {
    return image.resize(THUMBNAIL_WIDTH, null, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return image.resize(CONTENT_MAX_WIDTH, null, {
    fit: 'inside',
    withoutEnlargement: true,
  });
}

/**
 * Resize (and optionally watermark) an image, then store it under the member's media key.
 */
export async function processImage(input: ProcessImageInput): Promise<ProcessImageResult> {
  const ownerId = storageOwnerId(input.userId);
  const resized = await resizeForPurpose(
    sharp(input.buffer, { failOn: 'truncated' }).rotate(),
    input.contentType,
  ).toBuffer();

  let pipeline = sharp(resized);
  if (input.watermark) {
    const meta = await pipeline.metadata();
    const width = meta.width ?? 1;
    const height = meta.height ?? 1;
    pipeline = sharp(resized).composite([
      { input: watermarkSvg(width, height), top: 0, left: 0 },
    ]);
  }

  const output = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer({
    resolveWithObject: true,
  });

  const key = mediaKeyFor(ownerId, `${randomUUID()}.jpg`);
  await storeUpload(key, output.data, 'image/jpeg');

  return {
    key,
    url: `/api/media/${key}`,
    mimeType: 'image/jpeg',
    width: output.info.width,
    height: output.info.height,
    byteSize: output.data.length,
    contentType: input.contentType,
  };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().slice(0, 300) || `ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Pull a single JPEG frame from a video buffer (about 1s in, or the first frame).
 */
export async function extractVideoThumbnail(buffer: Buffer): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), 'dickrank-thumb-'));
  const inputPath = join(directory, 'input.bin');
  const outputPath = join(directory, 'thumb.jpg');

  try {
    await writeFile(inputPath, buffer);
    try {
      await runFfmpeg([
        '-y',
        '-ss',
        '1',
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        outputPath,
      ]);
    } catch {
      await runFfmpeg(['-y', '-i', inputPath, '-frames:v', '1', '-q:v', '2', outputPath]);
    }
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Store the original video next to processed derivatives.
 */
export async function storeOriginalVideo(input: {
  buffer: Buffer;
  userId: string;
  ext: string;
  mimeType: string;
}): Promise<{ key: string; url: string; byteSize: number }> {
  const ownerId = storageOwnerId(input.userId);
  const safeExt = input.ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp4';
  if (safeExt !== 'mp4' && safeExt !== 'webm') {
    throw new Error('Only MP4 and WebM videos can be stored');
  }
  const key = mediaKeyFor(ownerId, `${randomUUID()}.${safeExt}`);
  await storeUpload(key, input.buffer, input.mimeType);
  return {
    key,
    url: `/api/media/${key}`,
    byteSize: input.buffer.length,
  };
}
