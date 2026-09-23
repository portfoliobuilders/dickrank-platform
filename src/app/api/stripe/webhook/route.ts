import { NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { writeAuditLog } from "@/lib/audit";
import { GRACE_PERIOD_DAYS } from "@/lib/subscription-access";
import { getStripe } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripeIdSchema = z.union([z.string(), z.object({ id: z.string() })]);

const eventObjectSchema = z.object({
  id: z.string(),
  object: z.string(),
  subscription: stripeIdSchema.nullable().optional(),
  metadata: z.record(z.string()).optional(),
  parent: z
    .object({
      subscription_details: z
        .object({
          subscription: stripeIdSchema.optional(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
});

function idFrom(value: z.infer<typeof stripeIdSchema> | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function subscriptionIdFrom(object: z.infer<typeof eventObjectSchema>): string | null {
  return (
    idFrom(object.subscription) ??
    idFrom(object.parent?.subscription_details?.subscription) ??
    (object.object === "subscription" ? object.id : null)
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error("stripe webhook signature failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const object = eventObjectSchema.safeParse(event.data.object);
  if (!object.success) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    if (event.type === "invoice.payment_failed") {
      const stripeSubscriptionId = subscriptionIdFrom(object.data);
      if (stripeSubscriptionId) await markPaymentFailed(stripeSubscriptionId);
    } else if (event.type === "invoice.paid") {
      const stripeSubscriptionId = subscriptionIdFrom(object.data);
      if (stripeSubscriptionId) await markPaymentRecovered(stripeSubscriptionId);
    } else if (event.type === "customer.subscription.deleted") {
      await markSubscriptionEnded(object.data.id);
    } else if (event.type === "payment_intent.succeeded") {
      await grantPurchasedContent(object.data.metadata ?? {});
    }
  } catch (error) {
    console.error("stripe webhook handler failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function markPaymentFailed(stripeSubscriptionId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, payment_failed_at, status")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = z
    .object({
      id: z.string().uuid(),
      payment_failed_at: z.string().nullable(),
      status: z.string(),
    })
    .safeParse(data);
  if (!row.success) return;
  if (row.data.status === "CANCELLED") return;

  const failedAt = row.data.payment_failed_at ?? new Date().toISOString();
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: "PAST_DUE",
      payment_failed_at: failedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.data.id);
  if (updateError) throw new Error(updateError.message);

  await writeAuditLog({
    actorId: null,
    action: "update",
    entity: "subscription",
    entityId: row.data.id,
    metadata: { status: "PAST_DUE", graceDays: GRACE_PERIOD_DAYS },
  });
}

async function markPaymentRecovered(stripeSubscriptionId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = z.object({ id: z.string().uuid(), status: z.string() }).safeParse(data);
  if (!row.success || row.data.status === "CANCELLED") return;

  const subscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: "ACTIVE",
      payment_failed_at: null,
      end_date: periodEnd,
      renewal_date: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.data.id);
  if (updateError) throw new Error(updateError.message);

  await writeAuditLog({
    actorId: null,
    action: "update",
    entity: "subscription",
    entityId: row.data.id,
    metadata: { status: "ACTIVE" },
  });
}

async function markSubscriptionEnded(stripeSubscriptionId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = z.object({ id: z.string().uuid() }).safeParse(data);
  if (!row.success) return;

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: "CANCELLED",
      end_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.data.id);
  if (updateError) throw new Error(updateError.message);
}

async function grantPurchasedContent(metadata: Record<string, string>) {
  const parsed = z
    .object({
      purpose: z.literal("content_purchase"),
      userId: z.string().uuid(),
      contentId: z.string().uuid(),
      transactionId: z.string().uuid(),
    })
    .safeParse(metadata);
  if (!parsed.success) return;

  const supabase = getServiceSupabase();
  const { data: updated, error } = await supabase
    .from("transactions")
    .update({ status: "succeeded", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.transactionId)
    .eq("user_id", parsed.data.userId)
    .eq("content_id", parsed.data.contentId)
    .eq("status", "pending")
    .select("id");

  if (error && error.code !== "23505") throw new Error(error.message);
  if ((!updated || updated.length === 0) && error?.code !== "23505") return;

  await writeAuditLog({
    actorId: parsed.data.userId,
    action: "update",
    entity: "transaction",
    entityId: parsed.data.transactionId,
    metadata: { status: "succeeded", source: "stripe_webhook" },
  });
}
