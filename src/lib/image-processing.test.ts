import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractVideoThumbnail, processImage } from './image-processing';

describe('image-processing', () => {
  let root = '';
  let previousCwd = '';

  beforeEach(async () => {
    previousCwd = process.cwd();
    root = await mkdtemp(join(tmpdir(), 'dickrank-img-'));
    process.chdir(root);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('resizes avatars to a square JPEG and stores under a safe key', async () => {
    const source = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 40, g: 120, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    const avatar = await processImage({
      buffer: source,
      filename: 'photo.jpg',
      userId: 'user-abc-123',
      contentType: 'avatar',
      watermark: false,
    });

    expect(avatar.width).toBe(256);
    expect(avatar.height).toBe(256);
    expect(avatar.mimeType).toBe('image/jpeg');
    expect(avatar.key).toMatch(/^local\/userabc123\/.+\.jpg$/);
  });

  it('watermarks content images', async () => {
    const source = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
      .png()
      .toBuffer();

    const content = await processImage({
      buffer: source,
      filename: 'shot.png',
      userId: 'creator1',
      contentType: 'content',
      watermark: true,
    });

    expect(content.byteSize).toBeGreaterThan(0);
    expect(content.contentType).toBe('content');
    expect(content.mimeType).toBe('image/jpeg');
  });

  it('extracts a JPEG frame from a short MP4 when ffmpeg is available', async () => {
    const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    if (ffmpeg.status !== 0) {
      return;
    }

    const videoDir = await mkdtemp(join(tmpdir(), 'dickrank-vid-'));
    const videoPath = join(videoDir, 'sample.mp4');
    try {
      const make = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=blue:s=320x240:d=2',
          '-pix_fmt',
          'yuv420p',
          videoPath,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(make.status, 0, make.stderr);

      const videoBuffer = await readFile(videoPath);
      const thumb = await extractVideoThumbnail(videoBuffer);
      expect(thumb.length).toBeGreaterThan(100);
      const meta = await sharp(thumb).metadata();
      expect(meta.format).toBe('jpeg');
    } finally {
      await rm(videoDir, { recursive: true, force: true });
    }
  });
});
