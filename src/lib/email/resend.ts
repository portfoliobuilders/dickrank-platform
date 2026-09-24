import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://dickrank.online').replace(/\/$/, '');
}

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

export async function sendEmail(options: EmailOptions) {
  const resend = getResend();
  if (!resend) {
    console.info('email skipped: RESEND_API_KEY unset', { subject: options.subject });
    return { success: false as const, skipped: true as const };
  }

  if (!options.html && !options.text) {
    throw new Error('Email requires html or text content');
  }

  try {
    const from = options.from || process.env.EMAIL_FROM || 'DickRank <noreply@dickrank.online>';
    const base = {
      from,
      to: options.to,
      subject: options.subject,
      ...(options.attachments ? { attachments: options.attachments } : {}),
    };

    const { data, error } = await resend.emails.send(
      options.html
        ? { ...base, html: options.html, ...(options.text ? { text: options.text } : {}) }
        : { ...base, text: options.text as string },
    );

    if (error) {
      console.error('Email send error:', error);
      throw new Error(error.message);
    }

    return { success: true as const, id: data?.id };
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
}

// Email Templates
export const emailTemplates = {
  welcome: (username: string) => ({
    subject: 'Welcome to DickRank - Verify Your Account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to DickRank</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .logo { text-align: center; margin-bottom: 40px; }
          .logo h1 { color: #d4af37; font-size: 32px; margin: 0; }
          .content { background: #18181b; border-radius: 12px; padding: 40px; border: 1px solid #27272a; }
          h2 { color: #ffffff; margin-top: 0; }
          p { color: #a1a1aa; line-height: 1.6; }
          .button { display: inline-block; background: #d4af37; color: #000000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; margin-top: 40px; color: #71717a; font-size: 12px; }
          .highlight { color: #d4af37; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>DickRank</h1>
          </div>
          <div class="content">
            <h2>Welcome, ${username}!</h2>
            <p>Thank you for joining <span class="highlight">DickRank</span>, the premier platform for adult content ranking and discovery.</p>
            <p>To get started, please verify your age and complete your profile. This helps us maintain a safe, verified community.</p>
            <a href="${appUrl()}/verify-age" class="button">Verify Your Age</a>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} DickRank. All rights reserved.</p>
            <p>This email was sent to you because you registered on DickRank.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  ageVerified: (username: string) => ({
    subject: 'Age Verification Approved - Welcome to the Community',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .content { background: #18181b; border-radius: 12px; padding: 40px; border: 1px solid #27272a; }
          .success { color: #22c55e; font-size: 48px; text-align: center; margin-bottom: 20px; }
          .button { display: inline-block; background: #d4af37; color: #000000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <div class="success">✓</div>
            <h2 style="text-align: center; color: #22c55e;">Verified!</h2>
            <p style="text-align: center;">Congratulations ${username}! Your age verification has been approved.</p>
            <p style="text-align: center;">You now have full access to the DickRank platform.</p>
            <div style="text-align: center;">
              <a href="${appUrl()}/dashboard" class="button">Go to Dashboard</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  newSubscriber: (creatorName: string, subscriberUsername: string, tierName: string) => ({
    subject: `New ${tierName} Subscriber!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .content { background: #18181b; border-radius: 12px; padding: 40px; border: 1px solid #27272a; }
          .stats { background: #0a0a0a; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: #d4af37; color: #000000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2>🎉 New Subscriber!</h2>
            <p>Hi ${creatorName},</p>
            <p><strong>${subscriberUsername}</strong> just subscribed to your <strong>${tierName}</strong> tier!</p>
            <div class="stats">
              <p style="margin: 0; color: #d4af37; font-size: 24px; font-weight: bold;">+$${tierName === 'VIP' ? '24.99' : tierName === 'Elite' ? '49.99' : '9.99'}</p>
              <p style="margin: 5px 0 0 0; color: #71717a; font-size: 14px;">Monthly recurring revenue</p>
            </div>
            <a href="${appUrl()}/creator/subscribers" class="button">View Subscribers</a>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  newReview: (username: string, rating: number, reviewerName: string) => ({
    subject: `New ${rating}-Star Review from ${reviewerName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .content { background: #18181b; border-radius: 12px; padding: 40px; border: 1px solid #27272a; }
          .rating { color: #d4af37; font-size: 48px; text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: #d4af37; color: #000000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2>New Review!</h2>
            <p>Hi ${username},</p>
            <div class="rating">${'★'.repeat(Math.floor(rating))}${rating % 1 >= 0.5 ? '½' : ''}</div>
            <p style="text-align: center; font-size: 24px; font-weight: bold; color: #d4af37;">${rating}/10</p>
            <p style="text-align: center;">${reviewerName} left you a new review.</p>
            <div style="text-align: center;">
              <a href="${appUrl()}/profile/reviews" class="button">View Review</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  contentApproved: (title: string) => ({
    subject: 'Your Content Has Been Approved',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .content { background: #18181b; border-radius: 12px; padding: 40px; border: 1px solid #27272a; }
          .success { color: #22c55e; }
          .button { display: inline-block; background: #d4af37; color: #000000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2 class="success">✓ Content Approved</h2>
            <p>Your content <strong>"${title}"</strong> has been reviewed and approved.</p>
            <p>It's now live on the platform and available to your audience.</p>
            <a href="${appUrl()}/my-content" class="button">View My Content</a>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordReset: (resetUrl: string) => ({
    subject: 'Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .content { background: #18181b; border-radius: 12px; padding: 40px; border: 1px solid #27272a; }
          .button { display: inline-block; background: #d4af37; color: #000000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
          .warning { color: #ef4444; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2>Password Reset</h2>
            <p>You requested a password reset. Click the button below to set a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p class="warning">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

export type EmailTemplateName = keyof typeof emailTemplates;

type EmailTemplateData = {
  welcome: { username: string };
  ageVerified: { username: string };
  newSubscriber: { creatorName: string; subscriberUsername: string; tierName: string };
  newReview: { username: string; rating: number; reviewerName: string };
  contentApproved: { title: string };
  passwordReset: { resetUrl: string };
};

function renderTemplate<T extends EmailTemplateName>(type: T, data: EmailTemplateData[T]) {
  switch (type) {
    case 'welcome':
      return emailTemplates.welcome((data as EmailTemplateData['welcome']).username);
    case 'ageVerified':
      return emailTemplates.ageVerified((data as EmailTemplateData['ageVerified']).username);
    case 'newSubscriber': {
      const d = data as EmailTemplateData['newSubscriber'];
      return emailTemplates.newSubscriber(d.creatorName, d.subscriberUsername, d.tierName);
    }
    case 'newReview': {
      const d = data as EmailTemplateData['newReview'];
      return emailTemplates.newReview(d.username, d.rating, d.reviewerName);
    }
    case 'contentApproved':
      return emailTemplates.contentApproved((data as EmailTemplateData['contentApproved']).title);
    case 'passwordReset':
      return emailTemplates.passwordReset((data as EmailTemplateData['passwordReset']).resetUrl);
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown email template: ${_exhaustive}`);
    }
  }
}

/** Queue emails for batch sending via processEmailQueue. */
export async function queueEmail<T extends EmailTemplateName>(
  type: T,
  to: string,
  data: EmailTemplateData[T],
) {
  const template = renderTemplate(type, data);

  await prisma.emailQueue.create({
    data: {
      to,
      subject: template.subject,
      html: template.html,
      status: 'pending',
    },
  });
}

/** Deliver pending EmailQueue rows through Resend. */
export async function processEmailQueue(limit = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const pending = await prisma.emailQueue.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Math.max(limit, 1), 200),
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of pending) {
    try {
      const result = await sendEmail({
        to: item.to,
        subject: item.subject,
        html: item.html,
      });

      if ('skipped' in result && result.skipped) {
        skipped += 1;
        break;
      }

      await prisma.emailQueue.update({
        where: { id: item.id },
        data: { status: 'sent', sentAt: new Date(), error: null },
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown send error';
      await prisma.emailQueue.update({
        where: { id: item.id },
        data: { status: 'failed', error: message.slice(0, 500) },
      });
      failed += 1;
    }
  }

  return { processed: pending.length, sent, failed, skipped };
}
