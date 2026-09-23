import Stripe from 'stripe';
import { integrationIdentifier } from '@/lib/payments/ids';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
      appInfo: { name: 'DickRank', url: 'https://dickrank.online' },
    });
  }
  return stripeClient;
}

export async function createCustomer(input: { email: string; userId: string }): Promise<Stripe.Customer> {
  return getStripe().customers.create({
    email: input.email,
    metadata: { userId: input.userId },
  });
}

export async function createSubscriptionCheckout(input: {
  customerId: string;
  priceId: string;
  subscriberId: string;
  creatorId: string;
  tierId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const metadata = {
    subscriberId: input.subscriberId,
    creatorId: input.creatorId,
    tierId: input.tierId,
  };

  return getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: input.customerId,
    client_reference_id: input.subscriberId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata,
    subscription_data: { metadata },
    integration_identifier: integrationIdentifier('subscribe'),
  });
}

export async function ensureMonthlyPrice(input: {
  tierId: string;
  creatorId: string;
  name: string;
  priceCents: number;
  existingProductId: string | null;
  existingPriceId: string | null;
}): Promise<{ productId: string; priceId: string }> {
  const stripe = getStripe();
  if (input.existingPriceId && input.existingProductId) {
    const price = await stripe.prices.retrieve(input.existingPriceId);
    if (price.unit_amount !== input.priceCents || !price.active) {
      throw new Error('Stored Stripe price does not match the tier');
    }
    return { productId: input.existingProductId, priceId: input.existingPriceId };
  }

  const product = await stripe.products.create({
    name: input.name,
    metadata: { tierId: input.tierId, creatorId: input.creatorId },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: input.priceCents,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tierId: input.tierId, creatorId: input.creatorId },
  });
  return { productId: product.id, priceId: price.id };
}

export async function createPaymentIntent(input: {
  amountCents: number;
  customerId: string;
  tipperId: string;
  creatorId: string;
  idempotencyKey?: string;
  receiptEmail?: string | null;
}): Promise<Stripe.PaymentIntent> {
  return getStripe().paymentIntents.create(
    {
      amount: input.amountCents,
      currency: 'usd',
      customer: input.customerId,
      receipt_email: input.receiptEmail || undefined,
      metadata: {
        type: 'tip',
        tipperId: input.tipperId,
        creatorId: input.creatorId,
      },
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
  );
}

export function verifyWebhook(payload: string | Buffer, signature: string | null): Stripe.Event {
  if (!signature) {
    throw new Error('Missing Stripe signature');
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}

export async function createConnectedAccount(input: {
  email: string;
  displayName: string;
  country: string;
  creatorId: string;
  userId: string;
}): Promise<Stripe.V2.Core.Account> {
  return getStripe().v2.core.accounts.create({
    contact_email: input.email,
    display_name: input.displayName,
    dashboard: 'express',
    defaults: {
      responsibilities: {
        fees_collector: 'application',
        losses_collector: 'application',
      },
      profile: {
        product_description:
          'Adult creator subscriptions, tips, and digital content. Customers must be age-verified 18+.',
      },
    },
    identity: { country: input.country.toLowerCase() },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    metadata: { creatorId: input.creatorId, userId: input.userId },
    include: ['configuration.recipient', 'requirements', 'identity'],
  });
}

export async function createOnboardingLink(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<string> {
  const link = await getStripe().v2.core.accountLinks.create({
    account: input.accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['recipient'],
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        collection_options: { fields: 'eventually_due' },
      },
    },
  });
  return link.url;
}

export async function createAccountSession(accountId: string): Promise<string> {
  const session = await getStripe().accountSessions.create({
    account: accountId,
    components: {
      account_onboarding: { enabled: true },
      account_management: { enabled: true },
      notification_banner: { enabled: true },
    },
  });
  return session.client_secret;
}

export async function retrieveConnectedAccount(accountId: string): Promise<Stripe.V2.Core.Account> {
  return getStripe().v2.core.accounts.retrieve(accountId, {
    include: ['configuration.recipient', 'requirements', 'identity'],
  });
}

export function connectReadiness(account: Stripe.V2.Core.Account): {
  transfersActive: boolean;
  payoutsActive: boolean;
  identityVerified: boolean;
  bankAccountVerified: boolean;
} {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;
  const transfersActive = balance?.stripe_transfers?.status === 'active';
  const payoutsActive = balance?.payouts?.status === 'active';
  const entries = account.requirements?.entries ?? [];
  const identityDue = entries.some((entry) => {
    const due = entry.minimum_deadline?.status === 'currently_due' || entry.minimum_deadline?.status === 'past_due';
    return due && /identity|verification|id_number|representative|document/i.test(entry.description);
  });
  const bankDue = entries.some((entry) => {
    const due = entry.minimum_deadline?.status === 'currently_due' || entry.minimum_deadline?.status === 'past_due';
    return due && /bank|external account|payout/i.test(entry.description);
  });

  return {
    transfersActive,
    payoutsActive,
    identityVerified: transfersActive && !identityDue,
    bankAccountVerified: payoutsActive && !bankDue,
  };
}

export async function createCreatorTransfer(input: {
  accountId: string;
  amountCents: number;
  withdrawalId: string;
}): Promise<Stripe.Transfer> {
  return getStripe().transfers.create(
    {
      amount: input.amountCents,
      currency: 'usd',
      destination: input.accountId,
      metadata: { withdrawalId: input.withdrawalId },
    },
    { idempotencyKey: `transfer_${input.withdrawalId}` },
  );
}
