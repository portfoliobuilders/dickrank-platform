import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const SALT = 'dickrank-preferences-v1';

function encryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    if (process.env.DATA_BACKEND === 'memory' && process.env.NODE_ENV !== 'production') {
      return scryptSync('dev-only-memory-backend', SALT, 32);
    }
    throw new Error('ENCRYPTION_KEY is required to store preferences');
  }
  return scryptSync(secret, SALT, 32);
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptJson<T>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  try {
    const raw = Buffer.from(payload, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}
