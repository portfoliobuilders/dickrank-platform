import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/audit';
import { requireVerifiedUser } from '@/lib/auth';
import { ensureStripeCustomer } from '@/lib/payments/customers';
import { createSubscriptionSchema, fieldPaths } from '@/lib/payments/schemas';
import { clientSecretFromSubscription, createIncompleteSubscription, ensureMonthlyPrice } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', fields: fieldPaths(parsed.error) }, { status: 400 });
  }

  const auth = await requireVerifiedUser();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  const { data: creator, error: creatorError } = await admin
    .from('creators')
    .select('id, user_id, username, display_name')
    .eq('id', parsed.data.creatorId)
    .maybeSingle();

  if (creatorError || !creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }
  if (creator.user_id === auth.profile.id) {
    return NextResponse.json({ error: 'You cannot subscribe to yourself' }, { status: 400 });
  }

  const { data: existing } = await admin
    .from('subscriptions')
    .select('status')
    .eq('subscriber_id', auth.profile.id)
    .eq('creator_id', creator.id)
    .maybeSingle();
  if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
    return NextResponse.json({ error: 'You already have a subscription' }, { status: 409 });
  }

  const { data: tier, error: tierError } = await admin
    .from('subscription_tiers')
    .select('id, name, price_cents, stripe_product_id, stripe_price_id, active, creator_id')
    .eq('creator_id', creator.id)
    .eq('stripe_price_id', parsed.data.priceId)
    .eq('active', true)
    .maybeSingle();

  if (tierError || !tier) {
    return NextResponse.json({ error: 'Subscription price not found' }, { status: 404 });
  }

  try {
    await ensureMonthlyPrice({
      tierId: tier.id,
      creatorId: creator.id,
      name: `${creator.display_name || creator.username} — ${tier.name}`,
      priceCents: tier.price_cents,
      existingProductId: tier.stripe_product_id,
      existingPriceId: tier.stripe_price_id,
    });

    const customerId = await ensureStripeCustomer(auth.profile, auth.email);
    const subscription = await createIncompleteSubscription({
      customerId,
      priceId: tier.stripe_price_id!,
      subscriberId: auth.profile.id,
      creatorId: creator.id,
      tierId: tier.id,
      idempotencyKey: `sub_${auth.profile.id}_${creator.id}_${tier.id}`,
    });
    const clientSecret = clientSecretFromSubscription(subscription);
    if (!clientSecret) {
      return NextResponse.json({ error: 'Subscription payment could not be started' }, { status: 502 });
    }

    await writeAuditLog({
      actorId: auth.profile.id,
      action: 'create',
      entity: 'subscriptions',
      entityId: subscription.id,
      metadata: { creatorId: creator.id, tierId: tier.id, status: subscription.status },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret,
    });
  } catch (error) {
    console.error('create subscription failed', { message: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Could not create subscription' }, { status: 502 });
  }
}
