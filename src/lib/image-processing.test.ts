import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";

const putObjectBuffer = vi.fn();

vi.mock("@/lib/s3", () => ({
  putObjectBuffer: (...args: unknown[]) => putObjectBuffer(...args),
}));

describe("processImage", () => {
  beforeEach(() => {
    putObjectBuffer.mockReset();
    putObjectBuffer.mockImplementation(async (input: { key: string }) => ({
      key: input.key,
      url: `https://cdn.example.test/${input.key}`,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uploads WebP original and thumbnail with a blurhash", async () => {
    const { processImage } = await import("@/lib/image-processing");
    const buffer = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: { r: 40, g: 120, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await processImage({
      buffer,
      filename: "photo.jpg",
      userId: "user-123",
      contentType: "content",
      watermark: false,
    });

    expect(result.metadata.format).toBe("webp");
    expect(result.metadata.size).toBeGreaterThan(0);
    expect(result.blurhash.length).toBeGreaterThan(10);
    expect(result.originalUrl).toContain("original.webp");
    expect(result.thumbnailUrl).toContain("thumbnail.webp");
    expect(result.originalKey).toMatch(/^content\/user-123\/.+\/original\.webp$/);
    expect(putObjectBuffer).toHaveBeenCalledTimes(2);
  });

  it("square-crops avatars to 400x400", async () => {
    const { processImage } = await import("@/lib/image-processing");
    const buffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
      .png()
      .toBuffer();

    const result = await processImage({
      buffer,
      filename: "avatar.png",
      userId: "creator1",
      contentType: "avatar",
    });

    expect(result.metadata.width).toBe(400);
    expect(result.metadata.height).toBe(400);
    expect(result.originalKey).toMatch(/^avatars\/creator1\//);
  });

  it("rejects empty user ids after sanitizing", async () => {
    const { processImage } = await import("@/lib/image-processing");
    const buffer = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();

    await expect(
      processImage({
        buffer,
        filename: "x.png",
        userId: "@@@",
        contentType: "content",
        watermark: false,
      }),
    ).rejects.toThrow("Failed to process image");
  });
});

describe("extractVideoThumbnail", () => {
  it("pulls a JPEG frame from a short generated video", async () => {
    const { spawn } = await import("node:child_process");
    const { promises: fs } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dickrank-vid-"));
    const videoPath = path.join(dir, "sample.mp4");

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "ffmpeg",
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=blue:s=320x240:d=2",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          videoPath,
        ],
        { stdio: "ignore" },
      );
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
    });

    const videoBuffer = await fs.readFile(videoPath);
    const { extractVideoThumbnail } = await import("@/lib/image-processing");
    const thumb = await extractVideoThumbnail(videoBuffer);
    const meta = await sharp(thumb).metadata();

    expect(meta.format).toBe("jpeg");
    expect((meta.width ?? 0) > 0).toBe(true);

    await fs.rm(dir, { recursive: true, force: true });
  }, 60_000);
});
