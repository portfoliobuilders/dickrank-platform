const LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  maxEdge: 8000,
} as const;

export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp';

export type ImageInspection =
  | { ok: true; kind: ImageKind; width: number; height: number }
  | { ok: false; error: string };

function jpegSize(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function webpSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  const format = buffer.toString('ascii', 12, 16);
  if (format === 'VP8X') {
    return {
      width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
      height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
    };
  }
  if (format === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (format === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

function detect(buffer: Buffer): { kind: ImageKind; width: number; height: number } | null {
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { kind: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return { kind: 'gif', width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const size = webpSize(buffer);
    return size ? { kind: 'webp', ...size } : null;
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const size = jpegSize(buffer);
    return size ? { kind: 'jpeg', ...size } : null;
  }
  return null;
}

export function inspectImage(buffer: Buffer): ImageInspection {
  if (buffer.length === 0) return { ok: false, error: 'That image is empty.' };
  if (buffer.length > LIMITS.maxBytes) return { ok: false, error: 'Images must be 8 MB or smaller.' };
  const found = detect(buffer);
  if (!found) return { ok: false, error: 'Use a JPEG, PNG, GIF, or WebP image.' };
  if (found.width < 1 || found.height < 1 || found.width > LIMITS.maxEdge || found.height > LIMITS.maxEdge) {
    return { ok: false, error: 'That image is too large to process.' };
  }
  return { ok: true, ...found };
}
