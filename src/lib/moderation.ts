import {
  DetectFacesCommand,
  DetectModerationLabelsCommand,
  GetContentModerationCommand,
  GetFaceDetectionCommand,
  RekognitionClient,
  StartContentModerationCommand,
  StartFaceDetectionCommand,
  type ModerationLabel,
} from "@aws-sdk/client-rekognition";
import { ModerationStatus, Prisma, VirusScanStatus } from "@prisma/client";
import { createHmac, timingSafeEqual } from "crypto";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export type ModerationOutcome = "APPROVED" | "REJECTED" | "FLAGGED" | "MANUAL_REVIEW";

export type ModerationSignal = {
  name: string;
  parentName?: string;
  confidence: number;
};

export type FaceAgeSignal = {
  ageLow: number;
  ageHigh: number;
  confidence: number;
};

export type ModerationDecision = {
  outcome: ModerationOutcome;
  reason?: string;
  scores: ModerationSignal[];
};

const MINOR_PATTERN =
  /\b(minor|minors|child|children|underage|preteen|toddler|infant|kid|csam)\b/i;
const NONCONSENT_PATTERN =
  /\b(non[-\s]?consensual|rape|assault|coercion|forced|bestiality|incest)\b/i;

/** Expected on an adult platform. These do not trip the 50% review flag. */
const ALLOWED_ADULT_LABELS = new Set([
  "explicit",
  "explicit nudity",
  "nudity",
  "graphic male nudity",
  "graphic female nudity",
  "sexual activity",
  "illustrated explicit nudity",
  "adult toys",
  "suggestive",
  "female swimwear or underwear",
  "male swimwear or underwear",
  "partial nudity",
  "revealing clothes",
  "kissing",
  "non-explicit nudity",
  "non-explicit nudity of intimate parts and kissing",
  "barechested male",
  "exposed male genitalia",
  "exposed female genitalia",
  "exposed buttocks or anus",
  "exposed female nipple",
  "implied nudity",
  "obstructed intimate parts",
  "swimwear or underwear",
]);

function labelText(label: ModerationSignal): string {
  return `${label.parentName ?? ""} ${label.name}`.trim();
}

function isHardReject(label: ModerationSignal): "minor" | "nonconsensual" | null {
  const text = labelText(label);
  if (MINOR_PATTERN.test(text)) return "minor";
  if (NONCONSENT_PATTERN.test(text)) return "nonconsensual";
  return null;
}

function isAllowedAdultLabel(label: ModerationSignal): boolean {
  if (isHardReject(label)) return false;
  return ALLOWED_ADULT_LABELS.has(label.name.trim().toLowerCase());
}

/**
 * Minors and non-consensual content are rejected at 50% confidence or more.
 * A weaker signal is never auto-approved; it goes to manual review.
 * Other policy labels are flagged above 50% and approved below that.
 * Ordinary adult nudity is allowed.
 */
export function evaluateModeration(input: {
  labels: ModerationSignal[];
  faces: FaceAgeSignal[];
  providerAvailable: boolean;
}): ModerationDecision {
  const scores = input.labels.map((label) => ({
    name: label.name,
    parentName: label.parentName,
    confidence: label.confidence,
  }));

  if (!input.providerAvailable) {
    return {
      outcome: "MANUAL_REVIEW",
      reason: "Moderation provider unavailable",
      scores,
    };
  }

  for (const face of input.faces) {
    if (face.ageHigh < 18 && face.confidence >= 50) {
      return {
        outcome: "REJECTED",
        reason: "Possible minor detected",
        scores,
      };
    }
  }

  let uncertain = false;

  for (const face of input.faces) {
    if (face.ageLow < 18) {
      uncertain = true;
    }
  }

  for (const label of input.labels) {
    const kind = isHardReject(label);
    if (!kind) continue;
    if (label.confidence >= 50) {
      return {
        outcome: "REJECTED",
        reason: kind === "minor" ? "Possible minor detected" : "Non-consensual content detected",
        scores,
      };
    }
    uncertain = true;
  }

  if (uncertain) {
    return {
      outcome: "MANUAL_REVIEW",
      reason: "Safety signal needs a person to review",
      scores,
    };
  }

  const flagged = input.labels.some(
    (label) => !isAllowedAdultLabel(label) && label.confidence > 50,
  );
  if (flagged) {
    return {
      outcome: "FLAGGED",
      reason: "Moderation confidence is above 50%",
      scores,
    };
  }

  return { outcome: "APPROVED", scores };
}

function rekognition(): RekognitionClient {
  return new RekognitionClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });
}

function toSignals(labels: ModerationLabel[] | undefined): ModerationSignal[] {
  return (labels ?? [])
    .filter((label): label is ModerationLabel & { Name: string } => Boolean(label.Name))
    .map((label) => ({
      name: label.Name,
      parentName: label.ParentName,
      confidence: label.Confidence ?? 0,
    }));
}

export async function inspectImage(bucket: string, key: string): Promise<ModerationDecision> {
  try {
    const client = rekognition();
    const [moderation, faces] = await Promise.all([
      client.send(
        new DetectModerationLabelsCommand({
          Image: { S3Object: { Bucket: bucket, Name: key } },
          MinConfidence: 10,
        }),
      ),
      client.send(
        new DetectFacesCommand({
          Image: { S3Object: { Bucket: bucket, Name: key } },
          Attributes: ["ALL"],
        }),
      ),
    ]);

    const faceAges: FaceAgeSignal[] = (faces.FaceDetails ?? []).flatMap((face) => {
      if (face.AgeRange?.Low == null || face.AgeRange.High == null) return [];
      return [
        {
          ageLow: face.AgeRange.Low,
          ageHigh: face.AgeRange.High,
          confidence: face.Confidence ?? 0,
        },
      ];
    });

    return evaluateModeration({
      labels: toSignals(moderation.ModerationLabels),
      faces: faceAges,
      providerAvailable: true,
    });
  } catch {
    return evaluateModeration({ labels: [], faces: [], providerAvailable: false });
  }
}

export async function startVideoModeration(bucket: string, key: string): Promise<{
  moderationJobId: string;
  faceJobId: string;
} | null> {
  const topicArn = process.env.AWS_REKOGNITION_SNS_TOPIC_ARN;
  const roleArn = process.env.AWS_REKOGNITION_ROLE_ARN;
  if (!topicArn || !roleArn) return null;

  const channel = { SNSTopicArn: topicArn, RoleArn: roleArn };
  const client = rekognition();
  const [moderation, faces] = await Promise.all([
    client.send(
      new StartContentModerationCommand({
        Video: { S3Object: { Bucket: bucket, Name: key } },
        MinConfidence: 50,
        NotificationChannel: channel,
      }),
    ),
    client.send(
      new StartFaceDetectionCommand({
        Video: { S3Object: { Bucket: bucket, Name: key } },
        FaceAttributes: "ALL",
        NotificationChannel: channel,
      }),
    ),
  ]);

  if (!moderation.JobId || !faces.JobId) return null;
  return { moderationJobId: moderation.JobId, faceJobId: faces.JobId };
}

export async function collectVideoLabels(jobId: string): Promise<ModerationSignal[] | null> {
  try {
    const labels: ModerationSignal[] = [];
    let nextToken: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const response = await rekognition().send(
        new GetContentModerationCommand({ JobId: jobId, NextToken: nextToken, SortBy: "TIMESTAMP" }),
      );
      for (const item of response.ModerationLabels ?? []) {
        if (!item.ModerationLabel?.Name) continue;
        labels.push({
          name: item.ModerationLabel.Name,
          parentName: item.ModerationLabel.ParentName,
          confidence: item.ModerationLabel.Confidence ?? 0,
        });
      }
      nextToken = response.NextToken;
      if (!nextToken) break;
    }
    return labels;
  } catch {
    return null;
  }
}

export async function collectVideoFaces(jobId: string): Promise<FaceAgeSignal[] | null> {
  try {
    const faces: FaceAgeSignal[] = [];
    let nextToken: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const response = await rekognition().send(
        new GetFaceDetectionCommand({ JobId: jobId, NextToken: nextToken }),
      );
      for (const item of response.Faces ?? []) {
        const range = item.Face?.AgeRange;
        if (range?.Low == null || range.High == null) continue;
        faces.push({
          ageLow: range.Low,
          ageHigh: range.High,
          confidence: item.Face?.Confidence ?? 0,
        });
      }
      nextToken = response.NextToken;
      if (!nextToken) break;
    }
    return faces;
  } catch {
    return null;
  }
}

type PartialScores = {
  labels?: ModerationSignal[];
  faces?: FaceAgeSignal[];
  labelsReady?: boolean;
  facesReady?: boolean;
};

export async function recordVideoModerationPart(
  contentId: string,
  part: "labels" | "faces",
  value: ModerationSignal[] | FaceAgeSignal[] | null,
): Promise<void> {
  if (!value) {
    await applyModerationDecision(
      contentId,
      evaluateModeration({ labels: [], faces: [], providerAvailable: false }),
    );
    return;
  }

  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) return;

  const current = (content.moderationScores ?? {}) as PartialScores;
  const next: PartialScores = {
    ...current,
    [part]: value,
    [`${part}Ready`]: true,
  };

  if (!next.labelsReady || !next.facesReady) {
    await prisma.content.update({
      where: { id: contentId },
      data: { moderationScores: next as unknown as Prisma.InputJsonValue },
    });
    return;
  }

  await applyModerationDecision(
    contentId,
    evaluateModeration({
      labels: next.labels ?? [],
      faces: next.faces ?? [],
      providerAvailable: true,
    }),
  );
}

function statusFor(outcome: ModerationOutcome): ModerationStatus {
  if (outcome === "APPROVED") return ModerationStatus.APPROVED;
  if (outcome === "REJECTED") return ModerationStatus.REJECTED;
  if (outcome === "FLAGGED") return ModerationStatus.FLAGGED;
  return ModerationStatus.MANUAL_REVIEW;
}

export async function applyModerationDecision(
  contentId: string,
  decision: ModerationDecision,
): Promise<void> {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) return;

  const canApprove =
    decision.outcome === "APPROVED" &&
    (content.virusScanStatus === VirusScanStatus.CLEAN ||
      content.virusScanStatus === VirusScanStatus.SKIPPED);

  const outcome: ModerationOutcome = decision.outcome === "APPROVED" && !canApprove
    ? "FLAGGED"
    : decision.outcome;

  const moderationStatus = statusFor(outcome);
  const reason = outcome === "APPROVED" ? null : decision.reason ?? "Needs review";

  await prisma.$transaction(async (tx) => {
    await tx.content.update({
      where: { id: contentId },
      data: {
        moderationStatus,
        moderationScores: decision.scores as unknown as Prisma.InputJsonValue,
        rejectionReason: reason,
      },
    });

    if (
      moderationStatus === ModerationStatus.MANUAL_REVIEW ||
      moderationStatus === ModerationStatus.FLAGGED
    ) {
      await tx.manualReview.create({
        data: {
          contentId,
          reason: reason ?? "Needs review",
        },
      });
    }

    if (moderationStatus === ModerationStatus.REJECTED) {
      await tx.notification.create({
        data: {
          userId: content.userId,
          type: "CONTENT_REJECTED",
          message: "Your upload was rejected because it does not meet our safety rules.",
        },
      });
    }

    await writeAuditLog(tx, {
      userId: content.userId,
      action: "moderation.update",
      resource: "content",
      resourceId: contentId,
      metadata: { moderationStatus, reason },
    });
  });
}

export function signModerationBody(body: string): string {
  const secret = process.env.MODERATION_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing MODERATION_WEBHOOK_SECRET");
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyModerationSignature(body: string, signature: string | null): boolean {
  const secret = process.env.MODERATION_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

/** Runs image or video moderation for a content row created by the upload API. */
export async function runModerationForContent(contentId: string): Promise<void> {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) return;
  if (content.virusScanStatus === VirusScanStatus.INFECTED) return;

  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    await applyModerationDecision(
      contentId,
      evaluateModeration({ labels: [], faces: [], providerAvailable: false }),
    );
    return;
  }

  if (content.contentType.startsWith("video/")) {
    try {
      const jobs = await startVideoModeration(bucket, content.mediaKey);
      if (!jobs) {
        await applyModerationDecision(
          contentId,
          evaluateModeration({ labels: [], faces: [], providerAvailable: false }),
        );
        return;
      }
      await prisma.content.update({
        where: { id: contentId },
        data: {
          moderationJobId: jobs.moderationJobId,
          faceJobId: jobs.faceJobId,
          moderationStatus: ModerationStatus.PENDING,
          moderationScores: { labelsReady: false, facesReady: false },
        },
      });
    } catch {
      await applyModerationDecision(
        contentId,
        evaluateModeration({ labels: [], faces: [], providerAvailable: false }),
      );
    }
    return;
  }

  const decision = await inspectImage(bucket, content.mediaKey);
  await applyModerationDecision(contentId, decision);
}

/**
 * Starts the same work as POST /api/webhooks/moderation.
 * Called in-process so the upload request does not call itself over HTTP.
 * Rekognition video callbacks still arrive on that route.
 */
export async function triggerModerationWebhook(contentId: string): Promise<void> {
  await runModerationForContent(contentId);
}
