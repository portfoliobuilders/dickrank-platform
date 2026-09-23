import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_ENCRYPTION_KEY is not set");
  }
  return scryptSync(secret, "dickrank-pii-v1", 32);
}

export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptString(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Encrypted value is malformed");
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function encryptBytes(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function generateNumericCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashVerificationCode(code: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

export function verificationCodesMatch(code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashVerificationCode(code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
