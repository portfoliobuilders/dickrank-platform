import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/audit';
import { requireVerifiedUser } from '@/lib/auth';
import {
  completeWithdrawal,
  failWithdrawal,
  markWithdrawalProcessing,
  requestWithdrawal,
} from '@/lib/payments/ledger';
import { MIN_WITHDRAWAL_CENTS } from '@/lib/payments/money';
import { fieldPaths, withdrawSchema } from '@/lib/payments/schemas';
import { createCreatorTransfer } from '@/lib/stripe';
import { syncConnectedAccount } from '@/lib/payments/connect';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown = {};
  const raw = await request.text();
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  }

  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', fields: fieldPaths(parsed.error) }, { status: 400 });
  }

  const auth = await requireVerifiedUser();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('id, stripe_account_id, transfers_active, payouts_active, identity_verified, bank_account_verified')
    .eq('user_id', auth.profile.id)
    .maybeSingle();

  if (!creator) {
    return NextResponse.json({ error: 'Creator account required' }, { status: 403 });
  }
  if (!creator.stripe_account_id) {
    return NextResponse.json({ error: 'Finish payout setup before withdrawing' }, { status: 400 });
  }

  try {
    await syncConnectedAccount(creator.stripe_account_id);
  } catch (error) {
    console.error('connect sync failed', { message: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Could not verify the payout account' }, { status: 502 });
  }

  const { data: fresh } = await admin
    .from('creators')
    .select('transfers_active, payouts_active, identity_verified, bank_account_verified')
    .eq('id', creator.id)
    .single();

  if (!fresh?.identity_verified || !fresh.bank_account_verified || !fresh.transfers_active || !fresh.payouts_active) {
    return NextResponse.json(
      { error: 'A verified identity and bank account are required before payout' },
      { status: 400 },
    );
  }

  const { data: balanceRow } = await admin
    .from('creator_balances')
    .select('balance_cents')
    .eq('creator_id', creator.id)
    .maybeSingle();

  const available = balanceRow?.balance_cents ?? 0;
  const amountCents = parsed.data.amountCents ?? available;
  if (amountCents < MIN_WITHDRAWAL_CENTS) {
    return NextResponse.json({ error: 'Minimum withdrawal is $100' }, { status: 400 });
  }
  if (amountCents > available) {
    return NextResponse.json({ error: 'Amount is higher than the available balance' }, { status: 400 });
  }

  let withdrawalId: string | null = null;
  let transferred = false;
  try {
    withdrawalId = await requestWithdrawal(admin, creator.id, amountCents);
    await writeAuditLog({
      actorId: auth.profile.id,
      action: 'create',
      entity: 'withdrawals',
      entityId: withdrawalId,
      metadata: { amountCents, status: 'pending' },
    });

    const transfer = await createCreatorTransfer({
      accountId: creator.stripe_account_id,
      amountCents,
      withdrawalId,
    });
    transferred = true;
    await markWithdrawalProcessing(admin, withdrawalId, transfer.id);
    await completeWithdrawal(admin, withdrawalId);
    await writeAuditLog({
      actorId: auth.profile.id,
      action: 'update',
      entity: 'withdrawals',
      entityId: withdrawalId,
      metadata: { status: 'completed', amountCents },
    });

    return NextResponse.json({
      withdrawalId,
      status: 'completed',
      amountCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (withdrawalId && !transferred) {
      await failWithdrawal(admin, withdrawalId).catch((failError) => {
        console.error('withdrawal restore failed', {
          message: failError instanceof Error ? failError.message : 'unknown',
        });
      });
    }
    console.error('withdraw failed', { message });
    if (message.includes('minimum_withdrawal')) {
      return NextResponse.json({ error: 'Minimum withdrawal is $100' }, { status: 400 });
    }
    if (message.includes('insufficient_balance')) {
      return NextResponse.json({ error: 'Amount is higher than the available balance' }, { status: 400 });
    }
    if (transferred) {
      return NextResponse.json(
        { error: 'The payout was sent to Stripe. Check the dashboard before trying again.', withdrawalId },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: 'Could not request the payout' }, { status: 502 });
  }
}
