import { NextResponse } from 'next/server';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/audit';
import { isCronAuthorized } from '@/lib/cron-auth';
import {
  claimPendingEmails,
  decryptQueueRecipient,
  markEmailFailed,
  markEmailSent,
  releaseEmailClaim,
  sendEmail,
} from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict()
  .optional();

async function processEmails(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'This job is not authorized.' }, { status: 401 });
  }

  let limit = 100;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    let raw: unknown = undefined;
    try {
      const text = await request.text();
      raw = text ? JSON.parse(text) : undefined;
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    limit = parsed.data?.limit ?? 100;
  }

  try {
    const claimed = await claimPendingEmails(limit);

    const results = await Promise.allSettled(
      claimed.map(async (email) => {
        try {
          const to = decryptQueueRecipient(email.toEncrypted);
          const result = await sendEmail({
            to,
            subject: email.subject,
            html: email.html,
          });

          if (result.skipped) {
            await releaseEmailClaim(email.id, 'RESEND_API_KEY unset');
            return { success: false, id: email.id, skipped: true };
          }

          await markEmailSent(email.id);
          return { success: true, id: email.id };
        } catch (error) {
          await markEmailFailed(email.id, error, email.retryCount);
          throw error;
        }
      }),
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success),
    ).length;

    await writeAuditLog({
      actorId: null,
      action: 'email_queue.process',
      entity: 'email_queue',
      entityId: null,
      metadata: {
        processed: claimed.length,
        sent,
        failed,
      },
    });

    return NextResponse.json({
      success: true,
      processed: claimed.length,
      sent,
      failed,
    });
  } catch (error) {
    console.error('Email processor error:', error);
    return NextResponse.json({ error: 'Failed to process emails' }, { status: 500 });
  }
}

export function GET(request: Request) {
  return processEmails(request);
}

export function POST(request: Request) {
  return processEmails(request);
}
