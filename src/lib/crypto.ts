import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const BLOCKED_DETAIL_KEY =
  /email|phone|contact|ipaddress|ip_address|ssn|password|token|secret|signature|cookie|authorization/i;

function hashSecret(): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    throw new Error("IP_HASH_SALT is required");
  }
  return salt;
}

function encryptionKey(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("PII_ENCRYPTION_KEY is required");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PII_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }
  return key;
}

export function hashValue(purpose: "ip" | "email", value: string): string {
  return createHash("sha256").update(`${hashSecret()}:${purpose}:${value}`).digest("hex");
}

export function hashIp(ipAddress: string): string {
  return hashValue("ip", ipAddress.trim());
}

export function hashEmail(email: string): string {
  return hashValue("email", email.trim().toLowerCase());
}

export function encryptPii(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptPii(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Encrypted value is malformed");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function sanitizeDetails(details: unknown): Record<string, unknown> | undefined {
  if (details == null) return undefined;
  if (typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (BLOCKED_DETAIL_KEY.test(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null) {
      output[key] = value;
    }
  }
  return output;
}

export function formatHashedIp(hash: string): string {
  if (hash.length < 12) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}
