import { prisma } from "@/lib/prisma";
import { encryptPii } from "@/lib/crypto";

export async function notify(input: {
  userId?: string | null;
  email: string;
  subject: string;
  body: string;
}): Promise<void> {
  const record = await prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      recipientEncrypted: encryptPii(input.email),
      subject: input.subject,
      body: input.body,
      status: "PENDING",
    },
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "DickRank <noreply@dickrank.online>",
      to: [input.email],
      subject: input.subject,
      text: input.body,
    }),
  });

  await prisma.notification.update({
    where: { id: record.id },
    data: response.ok ? { status: "SENT", sentAt: new Date() } : { status: "FAILED" },
  });
}
