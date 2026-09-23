import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { requireAgeVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UploadValidationError, createPresignedUpload } from "@/lib/s3";
import { ALLOWED_CONTENT_TYPES } from "@/lib/uploadLimits";

export const runtime = "nodejs";

const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  fileSize: z.number().int().positive(),
});

export async function POST(request: Request) {
  const auth = await requireAgeVerifiedUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the file type and size." }, { status: 400 });
  }

  try {
    const upload = await createPresignedUpload({
      userId: auth.user.id,
      fileName: parsed.data.fileName,
      contentType: parsed.data.contentType,
      fileSize: parsed.data.fileSize,
    });

    await writeAuditLog(prisma, {
      userId: auth.user.id,
      action: "upload.presign",
      resource: "content",
      metadata: {
        key: upload.key,
        contentType: parsed.data.contentType,
        fileSize: parsed.data.fileSize,
      },
    });

    return NextResponse.json({
      uploadUrl: upload.uploadUrl,
      finalUrl: upload.finalUrl,
      key: upload.key,
      expiresIn: upload.expiresIn,
      requiredHeaders: upload.requiredHeaders,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }
}
