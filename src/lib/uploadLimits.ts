export const IMAGE_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 500 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

const ALLOWED = new Set<string>(ALLOWED_CONTENT_TYPES);

export function isVideoType(contentType: string): boolean {
  return contentType.startsWith("video/");
}

export function maxBytesFor(contentType: string): number {
  return isVideoType(contentType) ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
}

export function validateUploadFile(contentType: string, fileSize: number): string | null {
  if (!ALLOWED.has(contentType)) {
    return "Only JPEG, PNG, WebP, GIF, MP4, WebM, and QuickTime files are allowed.";
  }
  if (!Number.isInteger(fileSize) || fileSize <= 0) {
    return "File size is invalid.";
  }
  const max = maxBytesFor(contentType);
  if (fileSize > max) {
    return isVideoType(contentType)
      ? "Videos must be 500MB or smaller."
      : "Images must be 50MB or smaller.";
  }
  return null;
}

export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return (cleaned || "upload").slice(0, 80);
}
