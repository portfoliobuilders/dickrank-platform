import { describe, expect, it } from 'vitest';
import { emailTemplates } from './resend';

describe('emailTemplates', () => {
  it('builds a welcome message with the member name', () => {
    const mail = emailTemplates.welcome('nova');
    expect(mail.subject).toContain('Welcome');
    expect(mail.html).toContain('Welcome, nova!');
    expect(mail.html).toContain('/verify-age');
  });

  it('builds a password reset message with the reset link', () => {
    const mail = emailTemplates.passwordReset('https://dickrank.online/reset-password?token=abc');
    expect(mail.subject).toBe('Password Reset Request');
    expect(mail.html).toContain('https://dickrank.online/reset-password?token=abc');
  });

  it('renders half-star review ratings', () => {
    const mail = emailTemplates.newReview('creator', 8.5, 'reviewer');
    expect(mail.subject).toContain('8.5-Star');
    expect(mail.html).toContain('8.5/10');
    expect(mail.html).toContain('½');
  });
});
