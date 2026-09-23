import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/audit';
import { requireVerifiedUser } from '@/lib/auth';
import { syncConnectedAccount } from '@/lib/payments/connect';
import { appUrl } from '@/lib/payments/ids';
import { connectSchema, fieldPaths } from '@/lib/payments/schemas';
import { createAccountSession, createConnectedAccount, createOnboardingLink } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptPii } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireVerifiedUser();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('stripe_account_id, transfers_active, payouts_active, identity_verified, bank_account_verified')
    .eq('user_id', auth.profile.id)
    .maybeSingle();

  if (!creator) {
    return NextResponse.json({ error: 'Creator account required' }, { status: 403 });
  }

  if (creator.stripe_account_id) {
    try {
      await syncConnectedAccount(creator.stripe_account_id);
    } catch (error) {
      console.error('connect status sync failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const { data: fresh } = await admin
    .from('creators')
    .select('transfers_active, payouts_active, identity_verified, bank_account_verified, stripe_account_id')
    .eq('user_id', auth.profile.id)
    .single();

  return NextResponse.json({
    onboarded: Boolean(fresh?.stripe_account_id),
    transfersActive: Boolean(fresh?.transfers_active),
    payoutsActive: Boolean(fresh?.payouts_active),
    identityVerified: Boolean(fresh?.identity_verified),
    bankAccountVerified: Boolean(fresh?.bank_account_verified),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', fields: fieldPaths(parsed.error) }, { status: 400 });
  }

  const auth = await requireVerifiedUser();
  if ('error' in auth) return auth.error;
  if (!auth.email) {
    return NextResponse.json({ error: 'An email address is required for payout setup' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('id, username, display_name, country, stripe_account_id')
    .eq('user_id', auth.profile.id)
    .maybeSingle();

  if (!creator) {
    return NextResponse.json({ error: 'Creator account required' }, { status: 403 });
  }

  try {
    let accountId = creator.stripe_account_id as string | null;
    if (!accountId) {
      const country = (parsed.data.country || creator.country || 'US').toLowerCase();
      const account = await createConnectedAccount({
        email: auth.email,
        displayName: creator.display_name || creator.username,
        country,
        creatorId: creator.id,
        userId: auth.profile.id,
      });
      accountId = account.id;
      const patch: { stripe_account_id: string; email_encrypted?: string } = { stripe_account_id: accountId };
      if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32) {
        await admin.from('profiles').update({ email_encrypted: encryptPii(auth.email) }).eq('id', auth.profile.id);
      }
      const { error } = await admin.from('creators').update(patch).eq('id', creator.id);
      if (error) {
        return NextResponse.json({ error: 'Could not save the payout account' }, { status: 500 });
      }
      await writeAuditLog({
        actorId: auth.profile.id,
        action: 'create',
        entity: 'creators',
        entityId: creator.id,
        metadata: { connect: true },
      });
    }

    if (parsed.data.action === 'account_session') {
      const clientSecret = await createAccountSession(accountId);
      return NextResponse.json({ clientSecret });
    }

    const origin = appUrl();
    const url = await createOnboardingLink({
      accountId,
      refreshUrl: `${origin}/creator/onboarding?refresh=1`,
      returnUrl: `${origin}/creator/dashboard?onboarding=return`,
    });

    await writeAuditLog({
      actorId: auth.profile.id,
      action: 'create',
      entity: 'account_links',
      entityId: creator.id,
      metadata: { action: 'onboarding_link' },
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('connect onboarding failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Could not start payout setup' }, { status: 502 });
  }
}
