export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const DANGEROUS_EXTENSIONS = [
  'exe',
  'dll',
  'js',
  'mjs',
  'html',
  'htm',
  'svg',
  'sh',
  'bat',
  'cmd',
  'php',
  'jar',
  'scr',
] as const;

export function hasDangerousExtension(fileName: string): boolean {
  const parts = fileName.toLowerCase().split('.').slice(1);
  return parts.some((part) => (DANGEROUS_EXTENSIONS as readonly string[]).includes(part));
}
