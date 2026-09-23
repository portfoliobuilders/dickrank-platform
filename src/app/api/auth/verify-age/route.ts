import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireSessionUser } from "@/lib/auth";
import { DocumentValidationError, readIdImage, storeEncryptedDocument } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sessionUser = await requireSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "You must be signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ error: "Verify your email before uploading identification" }, { status: 403 });
  }
  if (user.ageVerified) {
    return NextResponse.json({ error: "Your age is already verified" }, { status: 409 });
  }

  const pendingReview = await prisma.reviewQueueItem.findFirst({
    where: { userId: user.id, status: "PENDING" },
  });
  if (pendingReview) {
    return NextResponse.json(
      { error: "Your documents are already waiting for manual review", verificationStatus: "PENDING" },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload the front, back, and selfie images" }, { status: 400 });
  }

  try {
    const front = await readIdImage(form.get("front"), "Front of ID");
    const back = await readIdImage(form.get("back"), "Back of ID");
    const selfie = await readIdImage(form.get("selfie"), "Selfie");

    const [encryptedFrontUrl, encryptedBackUrl, encryptedSelfieUrl] = await Promise.all([
      storeEncryptedDocument(user.id, "front", front),
      storeEncryptedDocument(user.id, "back", back),
      storeEncryptedDocument(user.id, "selfie", selfie),
    ]);

    await prisma.$transaction([
      prisma.verificationDocument.create({
        data: {
          userId: user.id,
          encryptedFrontUrl,
          encryptedBackUrl,
          encryptedSelfieUrl,
        },
      }),
      prisma.reviewQueueItem.create({
        data: { userId: user.id, status: "PENDING" },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          verificationStatus: "PENDING",
          documentSubmittedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "verification_document_upload",
          metadata: JSON.stringify({ queued: true }),
        },
      }),
    ]);

    return NextResponse.json({ verificationStatus: "PENDING", queued: true }, { status: 201 });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("verify-age failed");
    await writeAuditLog({
      userId: user.id,
      action: "verification_document_upload_failed",
    }).catch(() => undefined);
    return NextResponse.json({ error: "Could not store the identification documents" }, { status: 500 });
  }
}
