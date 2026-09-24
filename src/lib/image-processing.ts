import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { encode as encodeBlurhash } from "blurhash";
import sharp, { type Sharp } from "sharp";
import { putObjectBuffer } from "@/lib/s3";

export type ImageContentType = "avatar" | "thumbnail" | "content";

export type ProcessImageOptions = {
  buffer: Buffer;
  filename: string;
  userId: string;
  contentType: ImageContentType;
  /** Watermark content images. Default true for content, ignored otherwise. */
  watermark?: boolean;
};

export type ProcessedImage = {
  originalUrl: string;
  thumbnailUrl: string;
  originalKey: string;
  thumbnailKey: string;
  blurhash: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
};

const KEY_PREFIX: Record<ImageContentType, string> = {
  avatar: "avatars",
  thumbnail: "thumbnails",
  content: "content",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeUserSegment(userId: string): string {
  const cleaned = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleaned) {
    throw new Error("Invalid user id for media storage");
  }
  return cleaned;
}

async function buildBlurhash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encodeBlurhash(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

function watermarkSvg(width: number, height: number, userId: string): Buffer {
  const label = escapeXml(`DickRank.online | @${userId}`);
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" x="0" y="0" width="200" height="100" patternUnits="userSpaceOnUse">
          <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14"
            fill="rgba(255,255,255,0.15)" text-anchor="middle"
            transform="rotate(-45, 100, 50)">${label}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)"/>
    </svg>
  `);
}

/**
 * Optimize an image, strip EXIF, optionally watermark content, upload WebP
 * original + thumbnail to S3, and return a blurhash placeholder.
 */
export async function processImage(options: ProcessImageOptions): Promise<ProcessedImage> {
  const { buffer, filename, userId, contentType } = options;
  const watermark = options.watermark ?? contentType === "content";

  try {
    const owner = safeUserSegment(userId);
    const sourceMeta = await sharp(buffer).metadata();
    const width = sourceMeta.width ?? 0;
    const height = sourceMeta.height ?? 0;
    if (width <= 0 || height <= 0) {
      throw new Error("Image has no dimensions");
    }

    const blurhash = await buildBlurhash(buffer);

    // rotate() applies EXIF orientation; omitting withMetadata strips EXIF on export.
    let pipeline: Sharp = sharp(buffer).rotate();

    if (watermark && contentType === "content") {
      pipeline = pipeline.composite([
        { input: watermarkSvg(width, height, owner), gravity: "center" },
      ]);
    }

    if (contentType === "avatar") {
      pipeline = pipeline.resize(400, 400, {
        fit: "cover",
        position: "centre",
      });
    }

    const optimized = await pipeline.webp({ quality: 85, effort: 6 }).toBuffer({
      resolveWithObject: true,
    });

    const thumbnail = await sharp(buffer)
      .rotate()
      .resize(400, 300, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();

    const fileId = randomUUID();
    const keyPrefix = `${KEY_PREFIX[contentType]}/${owner}/${fileId}`;
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload";

    const [originalResult, thumbnailResult] = await Promise.all([
      putObjectBuffer({
        key: `${keyPrefix}/original.webp`,
        body: optimized.data,
        contentType: "image/webp",
        metadata: {
          "processed-by": "dickrank-image-processor",
          "source-filename": safeName,
          "uploaded-at": new Date().toISOString(),
        },
      }),
      putObjectBuffer({
        key: `${keyPrefix}/thumbnail.webp`,
        body: thumbnail,
        contentType: "image/webp",
        metadata: {
          "processed-by": "dickrank-image-processor",
          "uploaded-at": new Date().toISOString(),
        },
      }),
    ]);

    return {
      originalUrl: originalResult.url,
      thumbnailUrl: thumbnailResult.url,
      originalKey: originalResult.key,
      thumbnailKey: thumbnailResult.key,
      blurhash,
      metadata: {
        width: optimized.info.width,
        height: optimized.info.height,
        format: "webp",
        size: optimized.data.length,
      },
    };
  } catch (error) {
    console.error("Image processing error:", error);
    throw new Error("Failed to process image");
  }
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("FFmpeg timed out"));
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

/** Extract a JPEG still from a video buffer (frame near 1 second). */
export async function extractVideoThumbnail(videoBuffer: Buffer): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dickrank-thumb-"));
  const inputPath = path.join(tempDir, "input.mp4");
  const outputPath = path.join(tempDir, "thumb.jpg");

  try {
    await fs.writeFile(inputPath, videoBuffer);
    await runFfmpeg(
      [
        "-y",
        "-ss",
        "00:00:01",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        outputPath,
      ],
      30_000,
    );
    return await fs.readFile(outputPath);
  } catch (error) {
    console.error("Video thumbnail extraction error:", error);
    throw new Error("Failed to extract video thumbnail");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Extract a video still, then run it through the image pipeline as a thumbnail.
 */
export async function processVideoThumbnail(options: {
  videoBuffer: Buffer;
  userId: string;
  filename?: string;
}): Promise<ProcessedImage> {
  const still = await extractVideoThumbnail(options.videoBuffer);
  return processImage({
    buffer: still,
    filename: options.filename ?? "video-thumbnail.jpg",
    userId: options.userId,
    contentType: "thumbnail",
    watermark: false,
  });
}
