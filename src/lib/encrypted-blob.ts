import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("DRBK");
const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export function parseEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length === KEY_LENGTH && decoded.toString("base64").replace(/=+$/, "") === trimmed.replace(/=+$/, "")) {
    return decoded;
  }

  throw new Error("ENCRYPTION_KEY must be 32 bytes, as 64 hex characters or standard base64");
}

export function requireEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.trim() === "") {
    throw new Error("ENCRYPTION_KEY is required");
  }
  return parseEncryptionKey(raw);
}

/**
 * File layout: magic "DRBK" | version | 12-byte IV | ciphertext | 16-byte GCM tag.
 * Callers gzip plaintext before encryption when the payload is a database dump.
 */
export function encryptBuffer(plaintext: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error("Encryption key must be 32 bytes");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), iv, ciphertext, tag]);
}

export function decryptBuffer(payload: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error("Encryption key must be 32 bytes");
  }
  const headerLength = MAGIC.length + 1 + IV_LENGTH;
  if (payload.length < headerLength + TAG_LENGTH) {
    throw new Error("Encrypted payload is too short");
  }
  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Encrypted payload has an unexpected header");
  }
  const version = payload[MAGIC.length];
  if (version !== VERSION) {
    throw new Error(`Unsupported encrypted payload version ${version ?? "unknown"}`);
  }
  const ivStart = MAGIC.length + 1;
  const iv = payload.subarray(ivStart, ivStart + IV_LENGTH);
  const tag = payload.subarray(payload.length - TAG_LENGTH);
  const ciphertext = payload.subarray(ivStart + IV_LENGTH, payload.length - TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
