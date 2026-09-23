import type { SupabaseClient } from '@supabase/supabase-js';

export async function creditEarnings(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    grossCents: number;
    feeCents: number;
    netCents: number;
    type: 'subscription' | 'tip' | 'content_sale';
    payerId: string | null;
    stripeReference: string;
    description: string;
  },
): Promise<void> {
  const { error } = await admin.rpc('credit_creator_earnings', {
    p_creator_id: input.creatorId,
    p_gross_cents: input.grossCents,
    p_fee_cents: input.feeCents,
    p_net_cents: input.netCents,
    p_type: input.type,
    p_payer_id: input.payerId,
    p_stripe_reference: input.stripeReference,
    p_description: input.description,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function requestWithdrawal(
  admin: SupabaseClient,
  creatorId: string,
  amountCents: number,
): Promise<string> {
  const { data, error } = await admin.rpc('request_withdrawal', {
    p_creator_id: creatorId,
    p_amount_cents: amountCents,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (typeof data !== 'string') {
    throw new Error('Withdrawal was not created');
  }
  return data;
}

export async function markWithdrawalProcessing(
  admin: SupabaseClient,
  withdrawalId: string,
  transferId: string,
): Promise<void> {
  const { error } = await admin.rpc('mark_withdrawal_processing', {
    p_withdrawal_id: withdrawalId,
    p_transfer_id: transferId,
  });
  if (error) throw new Error(error.message);
}

export async function completeWithdrawal(admin: SupabaseClient, withdrawalId: string): Promise<void> {
  const { error } = await admin.rpc('complete_withdrawal', { p_withdrawal_id: withdrawalId });
  if (error) throw new Error(error.message);
}

export async function failWithdrawal(admin: SupabaseClient, withdrawalId: string): Promise<void> {
  const { error } = await admin.rpc('fail_withdrawal', { p_withdrawal_id: withdrawalId });
  if (error) throw new Error(error.message);
}
