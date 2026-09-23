import { ContentCategory, ContentPrivacy, VirusScanStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { requireAgeVerifiedUser } from "@/lib/auth";
import { CATEGORY_VALUES } from "@/lib/categories";
import { triggerModerationWebhook } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { assertKeyOwnedBy, finalObjectUrl } from "@/lib/s3";
import { validateUploadFile } from "@/lib/uploadLimits";
import { scanForViruses } from "@/lib/virusScan";

export const runtime = "nodejs";

const completeSchema = z.object({
  key: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(CATEGORY_VALUES as [string, ...string[]]),
  privacy: z.enum(["PUBLIC", "PRIVATE", "PREMIUM"]),
  contentType: z.string().trim().min(1),
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

  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Title, category, and privacy are required." }, { status: 400 });
  }

  const input = parsed.data;
  const sizeProblem = validateUploadFile(input.contentType, input.fileSize);
  if (sizeProblem) {
    return NextResponse.json({ error: sizeProblem }, { status: 400 });
  }
  if (!assertKeyOwnedBy(auth.user.id, input.key)) {
    return NextResponse.json({ error: "That upload does not belong to this account." }, { status: 403 });
  }

  const existing = await prisma.content.findUnique({ where: { mediaKey: input.key } });
  if (existing) {
    return NextResponse.json({ contentId: existing.id, duplicate: true });
  }

  const scan = await scanForViruses();
  if (scan.status === "infected" || scan.status === "unavailable") {
    await writeAuditLog(prisma, {
      userId: auth.user.id,
      action: "upload.virus_scan",
      resource: "content",
      metadata: { key: input.key, status: scan.status },
    });
    return NextResponse.json(
      { error: "This file could not be accepted." },
      { status: scan.status === "unavailable" ? 503 : 422 },
    );
  }

  const virusScanStatus = scan.status === "clean" ? VirusScanStatus.CLEAN : VirusScanStatus.SKIPPED;

  const content = await prisma.$transaction(async (tx) => {
    const created = await tx.content.create({
      data: {
        userId: auth.user.id,
        title: input.title,
        description: input.description || null,
        category: input.category as ContentCategory,
        privacy: input.privacy as ContentPrivacy,
        mediaKey: input.key,
        mediaUrl: finalObjectUrl(input.key),
        contentType: input.contentType,
        fileSize: input.fileSize,
        moderationStatus: "PENDING",
        virusScanStatus,
      },
    });

    await writeAuditLog(tx, {
      userId: auth.user.id,
      action: "upload.complete",
      resource: "content",
      resourceId: created.id,
      metadata: {
        category: input.category,
        privacy: input.privacy,
        contentType: input.contentType,
        fileSize: input.fileSize,
        virusScanStatus,
      },
    });

    return created;
  });

  await triggerModerationWebhook(content.id);

  return NextResponse.json({ contentId: content.id }, { status: 201 });
}
