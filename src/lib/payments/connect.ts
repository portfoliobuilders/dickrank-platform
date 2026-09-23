import { connectReadiness, retrieveConnectedAccount } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export async function syncConnectedAccount(accountId: string): Promise<void> {
  const account = await retrieveConnectedAccount(accountId);
  const flags = connectReadiness(account);
  const admin = createAdminClient();
  const { error } = await admin
    .from('creators')
    .update({
      transfers_active: flags.transfersActive,
      payouts_active: flags.payoutsActive,
      identity_verified: flags.identityVerified,
      bank_account_verified: flags.bankAccountVerified,
    })
    .eq('stripe_account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }
}
