import { createVerify } from "crypto";
import https from "https";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  collectVideoFaces,
  collectVideoLabels,
  recordVideoModerationPart,
  runModerationForContent,
  verifyModerationSignature,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const internalSchema = z.object({
  source: z.literal("upload-complete"),
  contentId: z.string().min(1),
});

const snsSchema = z.object({
  Type: z.enum(["Notification", "SubscriptionConfirmation", "UnsubscribeConfirmation"]),
  MessageId: z.string(),
  TopicArn: z.string(),
  Message: z.string(),
  Timestamp: z.string(),
  Signature: z.string(),
  SignatureVersion: z.string(),
  SigningCertURL: z.string().url(),
  Subject: z.string().optional(),
  SubscribeURL: z.string().url().optional(),
  Token: z.string().optional(),
});

const rekognitionMessageSchema = z.object({
  JobId: z.string(),
  Status: z.string(),
  API: z.string(),
});

const certCache = new Map<string, string>();

const certUrlPattern = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\/SimpleNotificationService-[A-Za-z0-9]+\.pem$/;

function stringToSign(message: Record<string, string | undefined>, type: string): string {
  const fields = type === "Notification"
    ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
    : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];

  return fields
    .filter((field) => field !== "Subject" || message.Subject)
    .map((field) => `${field}\n${message[field] ?? ""}\n`)
    .join("");
}

function fetchCert(url: string): Promise<string> {
  const cached = certCache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const pem = Buffer.concat(chunks).toString("utf8");
          certCache.set(url, pem);
          resolve(pem);
        });
      })
      .on("error", reject);
  });
}

async function verifySns(message: z.infer<typeof snsSchema>): Promise<boolean> {
  if (!certUrlPattern.test(message.SigningCertURL)) return false;
  const topic = process.env.AWS_REKOGNITION_SNS_TOPIC_ARN;
  if (!topic || message.TopicArn !== topic) return false;

  const pem = await fetchCert(message.SigningCertURL);
  const algorithm = message.SignatureVersion === "2" ? "sha256" : "sha1";
  const verifier = createVerify(algorithm);
  verifier.update(stringToSign(message, message.Type), "utf8");
  return verifier.verify(pem, message.Signature, "base64");
}

async function handleSns(message: z.infer<typeof snsSchema>) {
  const trusted = await verifySns(message);
  if (!trusted) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (message.Type === "SubscriptionConfirmation" && message.SubscribeURL) {
    const subscribeUrl = new URL(message.SubscribeURL);
    if (!subscribeUrl.hostname.endsWith(".amazonaws.com")) {
      return NextResponse.json({ error: "Invalid subscription URL." }, { status: 400 });
    }
    await fetch(message.SubscribeURL);
    return NextResponse.json({ ok: true });
  }

  if (message.Type !== "Notification") {
    return NextResponse.json({ ok: true });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(message.Message);
  } catch {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }

  const job = rekognitionMessageSchema.safeParse(parsed);
  if (!job.success) {
    return NextResponse.json({ error: "Unexpected callback." }, { status: 400 });
  }

  const content = job.data.API === "StartFaceDetection"
    ? await prisma.content.findFirst({ where: { faceJobId: job.data.JobId } })
    : await prisma.content.findFirst({ where: { moderationJobId: job.data.JobId } });

  if (!content) {
    return NextResponse.json({ ok: true });
  }

  if (job.data.Status !== "SUCCEEDED") {
    await recordVideoModerationPart(content.id, "labels", null);
    return NextResponse.json({ ok: true });
  }

  if (job.data.API === "StartFaceDetection") {
    const faces = await collectVideoFaces(job.data.JobId);
    await recordVideoModerationPart(content.id, "faces", faces);
  } else {
    const labels = await collectVideoLabels(job.data.JobId);
    await recordVideoModerationPart(content.id, "labels", labels);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-moderation-signature");

  if (verifyModerationSignature(raw, signature)) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const parsed = internalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    await runModerationForContent(parsed.data.contentId);
    return NextResponse.json({ ok: true });
  }

  let snsBody: unknown;
  try {
    snsBody = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const sns = snsSchema.safeParse(snsBody);
  if (!sns.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 401 });
  }

  try {
    return await handleSns(sns.data);
  } catch {
    return NextResponse.json({ error: "Moderation callback failed." }, { status: 500 });
  }
}
