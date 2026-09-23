import { encryptPii } from '@/lib/crypto';
import { createCustomer } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import type { VerifiedProfile } from '@/lib/auth';

export async function ensureStripeCustomer(profile: VerifiedProfile, email: string | null): Promise<string> {
  if (profile.stripe_customer_id) return profile.stripe_customer_id;
  if (!email) {
    throw new Error('An email address is required to pay');
  }

  const customer = await createCustomer({ email, userId: profile.id });
  const admin = createAdminClient();
  const patch: { stripe_customer_id: string; email_encrypted?: string } = {
    stripe_customer_id: customer.id,
  };

  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32) {
    patch.email_encrypted = encryptPii(email);
  }

  const { error } = await admin.from('profiles').update(patch).eq('id', profile.id);
  if (error) {
    console.error('failed to store stripe customer', { code: error.code });
  }
  return customer.id;
}
