import { decryptPii, encryptPii } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
};

const MAX_RETRIES = 3;

export function emailErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 500);
  return 'Unknown email error';
}

export async function sendEmail(input: EmailInput): Promise<{ skipped: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'DickRank <noreply@dickrank.online>';
  if (!apiKey) {
    console.info('email skipped: RESEND_API_KEY unset', { subject: input.subject });
    return { skipped: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend failed with status ${response.status}`);
  }

  return { skipped: false };
}

/** Queue an outbound email. Recipient is encrypted at rest. */
export async function enqueueEmail(input: EmailInput): Promise<{ id: string }> {
  const row = await prisma.emailQueue.create({
    data: {
      toEncrypted: encryptPii(input.to.trim().toLowerCase()),
      subject: input.subject,
      html: input.html,
      status: 'pending',
    },
    select: { id: true },
  });
  return row;
}

type QueueRow = {
  id: string;
  toEncrypted: string;
  subject: string;
  html: string;
  retryCount: number;
};

/** Claim up to `limit` pending rows by flipping them to processing. */
export async function claimPendingEmails(limit = 100): Promise<QueueRow[]> {
  const candidates = await prisma.emailQueue.findMany({
    where: { status: 'pending' },
    take: limit,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      toEncrypted: true,
      subject: true,
      html: true,
      retryCount: true,
    },
  });

  const claimed: QueueRow[] = [];
  for (const email of candidates) {
    const result = await prisma.emailQueue.updateMany({
      where: { id: email.id, status: 'pending' },
      data: { status: 'processing' },
    });
    if (result.count === 1) claimed.push(email);
  }
  return claimed;
}

export async function markEmailSent(id: string): Promise<void> {
  await prisma.emailQueue.update({
    where: { id },
    data: { status: 'sent', sentAt: new Date(), error: null },
  });
}

export async function markEmailFailed(id: string, error: unknown, retryCount: number): Promise<void> {
  const nextRetry = retryCount + 1;
  const retryable = nextRetry < MAX_RETRIES;
  await prisma.emailQueue.update({
    where: { id },
    data: {
      status: retryable ? 'pending' : 'failed',
      error: emailErrorMessage(error),
      retryCount: { increment: 1 },
    },
  });
}

/** Return a claimed row to pending without burning a retry (e.g. missing API key). */
export async function releaseEmailClaim(id: string, reason: string): Promise<void> {
  await prisma.emailQueue.update({
    where: { id },
    data: {
      status: 'pending',
      error: reason.slice(0, 500),
    },
  });
}

export function decryptQueueRecipient(toEncrypted: string): string {
  return decryptPii(toEncrypted);
}

export { MAX_RETRIES };
