import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { encryptBytes, encryptString } from "@/lib/crypto";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

export async function readIdImage(value: FormDataEntryValue | null, label: string): Promise<Buffer> {
  if (!(value instanceof File) || value.size === 0) {
    throw new DocumentValidationError(`${label} is required`);
  }
  if (!ALLOWED_TYPES.has(value.type)) {
    throw new DocumentValidationError(`${label} must be a JPEG, PNG, or WebP image`);
  }
  if (value.size > MAX_BYTES) {
    throw new DocumentValidationError(`${label} must be 5MB or smaller`);
  }
  return Buffer.from(await value.arrayBuffer());
}

export async function storeEncryptedDocument(userId: string, label: string, bytes: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), "storage", "verification", userId);
  await mkdir(dir, { recursive: true });
  const filename = `${label}-${Date.now()}-${randomBytes(6).toString("hex")}.bin`;
  await writeFile(path.join(dir, filename), encryptBytes(bytes), { mode: 0o600 });
  return encryptString(`secure://verification/${userId}/${filename}`);
}
