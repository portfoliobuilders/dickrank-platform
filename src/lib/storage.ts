import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function bucket(): string {
  const name = process.env.AWS_S3_BUCKET;
  if (!name) throw new Error("AWS_S3_BUCKET is required");
  return name;
}

function client(): S3Client {
  const region = process.env.AWS_REGION;
  if (!region) throw new Error("AWS_REGION is required");
  return new S3Client({ region });
}

export function storageConfigured(): boolean {
  return Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION);
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotFound" || name === "NoSuchKey") return;
    throw new Error("Unable to delete stored media");
  }
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    const result = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotFound" || name === "NoSuchKey") return null;
    throw new Error("Unable to read stored media");
  }
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function signedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(client(), command, { expiresIn: 60 * 15 });
}
