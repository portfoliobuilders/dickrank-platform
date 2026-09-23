import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/audit';
import { requireVerifiedUser } from '@/lib/auth';
import { ensureStripeCustomer } from '@/lib/payments/customers';
import { appUrl } from '@/lib/payments/ids';
import { fieldPaths, subscribeSchema } from '@/lib/payments/schemas';
import { createSubscriptionCheckout, ensureMonthlyPrice } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
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
    .eq('id', parsed.data.tierId)
    .maybeSingle();

  if (tierError || !tier || !tier.active || tier.creator_id !== creator.id) {
    return NextResponse.json({ error: 'Subscription tier not found' }, { status: 404 });
  }

  try {
    const priced = await ensureMonthlyPrice({
      tierId: tier.id,
      creatorId: creator.id,
      name: `${creator.display_name || creator.username} — ${tier.name}`,
      priceCents: tier.price_cents,
      existingProductId: tier.stripe_product_id,
      existingPriceId: tier.stripe_price_id,
    });

    if (priced.priceId !== tier.stripe_price_id) {
      const { error } = await admin
        .from('subscription_tiers')
        .update({ stripe_product_id: priced.productId, stripe_price_id: priced.priceId })
        .eq('id', tier.id);
      if (error) {
        return NextResponse.json({ error: 'Could not save the subscription price' }, { status: 500 });
      }
      await writeAuditLog({
        actorId: auth.profile.id,
        action: 'update',
        entity: 'subscription_tiers',
        entityId: tier.id,
        metadata: { priceCents: tier.price_cents },
      });
    }

    const customerId = await ensureStripeCustomer(auth.profile, auth.email);
    const origin = appUrl();
    const session = await createSubscriptionCheckout({
      customerId,
      priceId: priced.priceId,
      subscriberId: auth.profile.id,
      creatorId: creator.id,
      tierId: tier.id,
      successUrl: `${origin}/creator/${creator.username}/subscribe?status=success`,
      cancelUrl: `${origin}/creator/${creator.username}/subscribe?status=cancel`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Checkout could not be started' }, { status: 502 });
    }

    await writeAuditLog({
      actorId: auth.profile.id,
      action: 'create',
      entity: 'checkout_sessions',
      entityId: session.id,
      metadata: { creatorId: creator.id, tierId: tier.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('subscribe failed', { message: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 });
  }
}
