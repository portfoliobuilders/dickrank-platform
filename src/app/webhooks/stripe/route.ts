import { NextResponse } from 'next/server';
import type { Prisma, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { z } from 'zod';
import { writeAudit } from '@/lib/audit';
import { HttpError, isUniqueConstraint } from '@/lib/errors';
import { jsonError, withApi } from '@/lib/http';
import { getPrisma } from '@/lib/prisma';
import { stripeMetadataSchema } from '@/lib/validations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const subscriptionPayloadSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  customer: z.union([z.string(), z.object({ id: z.string() })]).nullable().optional(),
  metadata: z.record(z.string()).optional().default({}),
  current_period_end: z.number().nullable().optional(),
  items: z
    .object({
      data: z
        .array(
          z.object({
            price: z.object({ id: z.string() }).nullable().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const checkoutPayloadSchema = z.object({
  id: z.string().min(1),
  customer: z.union([z.string(), z.object({ id: z.string() })]).nullable().optional(),
  subscription: z.union([z.string(), z.object({ id: z.string() })]).nullable().optional(),
  metadata: z.record(z.string()).optional().default({}),
  payment_status: z.string().optional(),
  mode: z.string().optional(),
});

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpError('Payments are not configured', 500);
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

function externalId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function mapStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    case 'unpaid':
      return 'UNPAID';
    default:
      return 'INCOMPLETE';
  }
}

async function rememberEvent(
  eventId: string,
  eventType: string,
  apply: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { id: eventId, type: eventType } });
      await apply(tx);
    });
  } catch (error) {
    if (isUniqueConstraint(error)) return { duplicate: true };
    throw error;
  }
  return { duplicate: false };
}

export const POST = withApi(async (request) => {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature) return jsonError('Missing Stripe signature', 400);
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    throw new HttpError('Payments are not configured', 500);
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return jsonError('Invalid Stripe signature', 400);
  }

  const handled = new Set([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'checkout.session.completed',
  ]);

  if (!handled.has(event.type)) {
    await rememberEvent(event.id, event.type, async (tx) => {
      await writeAudit(tx, {
        action: 'update',
        entityType: 'stripe_event',
        entityId: event.id,
        metadata: { result: 'ignored', type: event.type },
      });
    });
    return NextResponse.json({ received: true, ignored: true });
  }

  if (event.type === 'checkout.session.completed') {
    const session = checkoutPayloadSchema.parse(event.data.object);
    const metadata = stripeMetadataSchema.safeParse(session.metadata);
    const subscriptionId = externalId(session.subscription);
    if (!metadata.success || !subscriptionId || metadata.data.subscriberId === metadata.data.creatorId) {
      const result = await rememberEvent(event.id, event.type, async (tx) => {
        await writeAudit(tx, {
          action: 'update',
          entityType: 'stripe_event',
          entityId: event.id,
          metadata: { result: 'ignored', type: event.type },
        });
      });
      return NextResponse.json({ received: true, ignored: true, duplicate: result.duplicate });
    }

    const { subscriberId, creatorId } = metadata.data;
    const result = await rememberEvent(event.id, event.type, async (tx) => {
      const [subscriber, creator] = await Promise.all([
        tx.user.findUnique({ where: { id: subscriberId }, select: { id: true } }),
        tx.user.findUnique({ where: { id: creatorId }, select: { id: true } }),
      ]);
      if (!subscriber || !creator) {
        await writeAudit(tx, {
          action: 'update',
          entityType: 'subscription',
          metadata: { result: 'missing_account' },
        });
        return;
      }
      const status: SubscriptionStatus = session.payment_status === 'paid' ? 'ACTIVE' : 'INCOMPLETE';
      await tx.subscription.upsert({
        where: { subscriberId_creatorId: { subscriberId, creatorId } },
        create: {
          subscriberId,
          creatorId,
          stripeCustomerId: externalId(session.customer),
          stripeSubscriptionId: subscriptionId,
          status,
        },
        update: {
          stripeCustomerId: externalId(session.customer),
          stripeSubscriptionId: subscriptionId,
          status,
        },
      });
      await writeAudit(tx, {
        action: 'create',
        entityType: 'subscription',
        entityId: subscriptionId,
        metadata: { status, subscriberId, creatorId },
      });
    });
    return NextResponse.json({ received: true, duplicate: result.duplicate });
  }

  const subscription = subscriptionPayloadSchema.parse(event.data.object);
  const metadata = stripeMetadataSchema.safeParse(subscription.metadata);
  if (!metadata.success || metadata.data.subscriberId === metadata.data.creatorId) {
    const result = await rememberEvent(event.id, event.type, async (tx) => {
      await writeAudit(tx, {
        action: 'update',
        entityType: 'stripe_event',
        entityId: event.id,
        metadata: { result: 'ignored', type: event.type },
      });
    });
    return NextResponse.json({ received: true, ignored: true, duplicate: result.duplicate });
  }

  const { subscriberId, creatorId } = metadata.data;
  const status = event.type === 'customer.subscription.deleted' ? 'CANCELED' : mapStatus(subscription.status);
  const result = await rememberEvent(event.id, event.type, async (tx) => {
    const [subscriber, creator] = await Promise.all([
      tx.user.findUnique({ where: { id: subscriberId }, select: { id: true } }),
      tx.user.findUnique({ where: { id: creatorId }, select: { id: true } }),
    ]);
    if (!subscriber || !creator) {
      await writeAudit(tx, {
        action: 'update',
        entityType: 'subscription',
        metadata: { result: 'missing_account' },
      });
      return;
    }
    await tx.subscription.upsert({
      where: { subscriberId_creatorId: { subscriberId, creatorId } },
      create: {
        subscriberId,
        creatorId,
        stripeCustomerId: externalId(subscription.customer),
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items?.data?.[0]?.price?.id,
        status,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
      },
      update: {
        stripeCustomerId: externalId(subscription.customer),
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items?.data?.[0]?.price?.id,
        status,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
      },
    });
    await writeAudit(tx, {
      action: event.type === 'customer.subscription.created' ? 'create' : 'update',
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: { status, subscriberId, creatorId },
    });
  });

  return NextResponse.json({ received: true, duplicate: result.duplicate });
});
