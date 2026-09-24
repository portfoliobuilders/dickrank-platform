import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { writeAuditLog } from '@/lib/audit';
import { enqueueEmail } from '@/lib/email';
import { creditEarnings, completeWithdrawal, markWithdrawalProcessing } from '@/lib/payments/ledger';
import { splitAmount, formatUsd } from '@/lib/payments/money';
import { syncConnectedAccount } from '@/lib/payments/connect';
import { verifyWebhook } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = verifyWebhook(payload, request.headers.get('stripe-signature'));
  } catch (error) {
    console.error('webhook signature rejected', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from('stripe_events').select('id').eq('id', event.id).maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        await onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'payment_intent.succeeded':
        await onTipSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await onTipFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'transfer.created':
        await onTransferCreated(event.data.object as Stripe.Transfer);
        break;
      default:
        if (event.type.startsWith('v2.core.account') || event.type === 'account.updated') {
          const accountId = accountIdFromEvent(event);
          if (accountId) await syncConnectedAccount(accountId);
        }
        break;
    }

    const { error } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
    if (error && error.code !== '23505') {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('webhook handler failed', {
      type: event.type,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function accountIdFromEvent(event: Stripe.Event): string | null {
  const object = event.data?.object as { id?: string; object?: string } | undefined;
  if (object?.id && (object.object === 'account' || object.object === 'v2.core.account')) {
    return object.id;
  }
  const related = (event as Stripe.Event & { related_object?: { id?: string } }).related_object;
  return related?.id ?? null;
}

async function emailFor(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

function periodEndIso(subscription: Stripe.Subscription): string | null {
  const end = subscription.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

async function upsertSubscription(input: {
  subscriberId: string;
  creatorId: string;
  tierId: string | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('subscriptions').upsert(
    {
      subscriber_id: input.subscriberId,
      creator_id: input.creatorId,
      tier_id: input.tierId,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_customer_id: input.stripeCustomerId,
      status: input.status,
      current_period_end: input.currentPeriodEnd,
      canceled_at: input.canceledAt,
    },
    { onConflict: 'subscriber_id,creator_id' },
  );
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorId: input.subscriberId,
    action: 'update',
    entity: 'subscriptions',
    entityId: input.stripeSubscriptionId,
    metadata: { status: input.status, creatorId: input.creatorId },
  });
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return;
  const subscriberId = session.metadata?.subscriberId;
  const creatorId = session.metadata?.creatorId;
  const tierId = session.metadata?.tierId;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!subscriberId || !creatorId || !tierId || !subscriptionId) return;

  const subscription = await (await import('@/lib/stripe')).getStripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  await upsertSubscription({
    subscriberId,
    creatorId,
    tierId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    status: subscription.status,
    currentPeriodEnd: periodEndIso(subscription),
    canceledAt: null,
  });

  const email = await emailFor(subscriberId);
  if (email) {
await enqueueEmail({
            to: email,
            subject: 'Your subscription is active',
            html: '<p>Your subscription is active. You can manage it from your account. This confirmation was sent because checkout completed.</p>',
          });
  }
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const details = invoice.parent?.subscription_details;
  const subscriptionRef = details?.subscription;
  const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
  const metadata = details?.metadata ?? {};
  const subscriberId = metadata.subscriberId;
  const creatorId = metadata.creatorId;
  const tierId = metadata.tierId ?? null;
  if (!subscriptionId || !subscriberId || !creatorId || invoice.amount_paid <= 0) return;

  const stripe = (await import('@/lib/stripe')).getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
  await upsertSubscription({
    subscriberId,
    creatorId,
    tierId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    status: subscription.status,
    currentPeriodEnd: periodEndIso(subscription),
    canceledAt: null,
  });

  const { feeCents, netCents } = splitAmount(invoice.amount_paid);
  if (netCents <= 0) return;
  await creditEarnings(createAdminClient(), {
    creatorId,
    grossCents: invoice.amount_paid,
    feeCents,
    netCents,
    type: 'subscription',
    payerId: subscriberId,
    stripeReference: invoice.id,
    description: 'Subscription payment',
  });

  await writeAuditLog({
    actorId: subscriberId,
    action: 'create',
    entity: 'transactions',
    entityId: invoice.id,
    metadata: { type: 'subscription', grossCents: invoice.amount_paid, creatorId },
  });

  const email = await emailFor(subscriberId);
  if (email) {
    await enqueueEmail({
      to: email,
      subject: 'Payment received',
      html: `<p>We received your subscription payment of ${formatUsd(invoice.amount_paid)}.</p>`,
    });
  }
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriberId = subscription.metadata?.subscriberId;
  const creatorId = subscription.metadata?.creatorId;
  const tierId = subscription.metadata?.tierId ?? null;
  if (!subscriberId || !creatorId) return;

  await upsertSubscription({
    subscriberId,
    creatorId,
    tierId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
    status: 'canceled',
    currentPeriodEnd: periodEndIso(subscription),
    canceledAt: new Date().toISOString(),
  });

  const email = await emailFor(subscriberId);
  if (email) {
    await enqueueEmail({
      to: email,
      subject: 'Your subscription has ended',
      html: '<p>Your subscription has been canceled and will not renew.</p>',
    });
  }
}

async function onTipSucceeded(intent: Stripe.PaymentIntent) {
  if (intent.metadata?.type !== 'tip') return;
  const tipperId = intent.metadata.tipperId;
  const creatorId = intent.metadata.creatorId;
  if (!tipperId || !creatorId) return;

  const { feeCents, netCents } = splitAmount(intent.amount_received || intent.amount);
  await creditEarnings(createAdminClient(), {
    creatorId,
    grossCents: intent.amount_received || intent.amount,
    feeCents,
    netCents,
    type: 'tip',
    payerId: tipperId,
    stripeReference: intent.id,
    description: 'Tip',
  });

  await writeAuditLog({
    actorId: tipperId,
    action: 'create',
    entity: 'tips',
    entityId: intent.id,
    metadata: { creatorId, amountCents: intent.amount },
  });

  const email = await emailFor(tipperId);
  if (email) {
    await enqueueEmail({
      to: email,
      subject: 'Tip sent',
      html: `<p>Your tip of ${formatUsd(intent.amount)} was received.</p>`,
    });
  }
}

async function onTipFailed(intent: Stripe.PaymentIntent) {
  if (intent.metadata?.type !== 'tip') return;
  const admin = createAdminClient();
  await admin.from('tips').update({ status: 'failed' }).eq('stripe_payment_intent_id', intent.id);
}

async function onTransferCreated(transfer: Stripe.Transfer) {
  const withdrawalId = transfer.metadata?.withdrawalId;
  if (!withdrawalId) return;
  const admin = createAdminClient();
  await markWithdrawalProcessing(admin, withdrawalId, transfer.id);
  await completeWithdrawal(admin, withdrawalId);
  await writeAuditLog({
    actorId: null,
    action: 'update',
    entity: 'withdrawals',
    entityId: withdrawalId,
    metadata: { status: 'completed' },
  });
}
