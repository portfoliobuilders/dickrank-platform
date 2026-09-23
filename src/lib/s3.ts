import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { safeFileName, validateUploadFile } from "@/lib/uploadLimits";

const UPLOAD_EXPIRES_SECONDS = 15 * 60;

export type PresignedUpload = {
  uploadUrl: string;
  finalUrl: string;
  key: string;
  expiresIn: number;
  requiredHeaders: Record<string, string>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: requireEnv("AWS_REGION"),
      credentials: {
        accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

function encryptionHeaders(): { algorithm: "AES256" | "aws:kms"; headers: Record<string, string>; kmsKeyId?: string } {
  const kmsKeyId = process.env.AWS_S3_KMS_KEY_ID;
  if (kmsKeyId) {
    return {
      algorithm: "aws:kms",
      kmsKeyId,
      headers: {
        "x-amz-server-side-encryption": "aws:kms",
        "x-amz-server-side-encryption-aws-kms-key-id": kmsKeyId,
      },
    };
  }
  return {
    algorithm: "AES256",
    headers: { "x-amz-server-side-encryption": "AES256" },
  };
}

export function buildObjectKey(userId: string, fileName: string): string {
  const owner = userId.replace(/[^a-zA-Z0-9-]/g, "");
  return `content/${owner}/${randomUUID()}/${safeFileName(fileName)}`;
}

export function assertKeyOwnedBy(userId: string, key: string): boolean {
  const owner = userId.replace(/[^a-zA-Z0-9-]/g, "");
  return key.startsWith(`content/${owner}/`) && !key.includes("..");
}

export function finalObjectUrl(key: string): string {
  const cloudfront = process.env.CLOUDFRONT_DOMAIN;
  if (cloudfront) {
    return `https://${cloudfront}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
  const bucket = requireEnv("AWS_S3_BUCKET");
  const region = requireEnv("AWS_REGION");
  return `https://${bucket}.s3.${region}.amazonaws.com/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Presigns a PUT to a private bucket. The bucket must also have default
 * encryption enabled. The signed request itself requires SSE so a client
 * cannot upload an unencrypted object.
 */
export async function createPresignedUpload(input: {
  userId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}): Promise<PresignedUpload> {
  const problem = validateUploadFile(input.contentType, input.fileSize);
  if (problem) {
    throw new UploadValidationError(problem);
  }

  const key = buildObjectKey(input.userId, input.fileName);
  const encryption = encryptionHeaders();
  const command = new PutObjectCommand({
    Bucket: requireEnv("AWS_S3_BUCKET"),
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.fileSize,
    ServerSideEncryption: encryption.algorithm,
    SSEKMSKeyId: encryption.kmsKeyId,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: UPLOAD_EXPIRES_SECONDS,
  });

  return {
    uploadUrl,
    finalUrl: finalObjectUrl(key),
    key,
    expiresIn: UPLOAD_EXPIRES_SECONDS,
    requiredHeaders: {
      "Content-Type": input.contentType,
      ...encryption.headers,
    },
  };
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}
