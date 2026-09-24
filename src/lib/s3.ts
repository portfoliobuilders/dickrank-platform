import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function createS3Client(): S3Client {
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const endpoint = process.env.AWS_S3_ENDPOINT?.trim() || undefined;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
    throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together");
  }

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
}

export function requireBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is required");
  }
  return bucket;
}

/** SSE-S3 on AWS. Local MinIO (AWS_S3_ENDPOINT) stores the already-encrypted object as-is. */
export function serverSideEncryption(): { ServerSideEncryption: "AES256" } | Record<string, never> {
  if (process.env.AWS_S3_ENDPOINT?.trim()) {
    return {};
  }
  return { ServerSideEncryption: "AES256" };
}

/** Public CDN or direct S3 URL for an object key. */
export function publicObjectUrl(key: string): string {
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const cloudfront = process.env.CLOUDFRONT_DOMAIN?.trim();
  if (cloudfront) {
    const host = cloudfront.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}/${encoded}`;
  }
  const bucket = requireBucket();
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const endpoint = process.env.AWS_S3_ENDPOINT?.trim();
  if (endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${bucket}/${encoded}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${encoded}`;
}

export async function putObjectBuffer(input: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{ url: string; key: string }> {
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: requireBucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: input.metadata,
      ...serverSideEncryption(),
    }),
  );
  return { url: publicObjectUrl(input.key), key: input.key };
}
