import { sendEmail as deliverEmail } from './resend';

export {
  sendEmail as sendResendEmail,
  emailTemplates,
  queueEmail,
  processEmailQueue,
} from './resend';

export type { EmailTemplateName } from './resend';

type EmailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Compatibility helper used by payment webhooks.
 * Never throws — a failed email must not roll back Stripe handling.
 */
export async function sendEmail(input: EmailInput): Promise<void> {
  try {
    await deliverEmail(input);
  } catch (error) {
    console.error('email send failed', {
      subject: input.subject,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
