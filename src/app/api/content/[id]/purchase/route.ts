import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getContent } from "@/lib/content-access";
import { isIndividuallyPurchasable } from "@/lib/access-policy";
import { getStripe, STRIPE_MIN_CHARGE_CENTS } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9]+$/).optional(),
});

const transactionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "succeeded", "failed"]),
  amount_cents: z.number().int(),
  stripe_payment_intent_id: z.string().nullable(),
  user_id: z.string().uuid(),
  content_id: z.string().uuid(),
});

export async function POST(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) {
    return NextResponse.json({ hasAccess: false, reason: "invalid_id" }, { status: 400 });
  }

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ hasAccess: false, reason: "invalid_body" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ hasAccess: false, reason: "unauthenticated" }, { status: 401 });
    }
    if (!user.ageVerified) {
      return NextResponse.json({ hasAccess: false, reason: "age_verification_required" }, { status: 403 });
    }

    const content = await getContent(params.data.id);
    if (!content) {
      return NextResponse.json({ hasAccess: false, reason: "not_found" }, { status: 404 });
    }
    if (!isIndividuallyPurchasable(content.price, content.accessType) || content.price === null) {
      return NextResponse.json({ hasAccess: false, reason: "content_not_purchasable" }, { status: 400 });
    }
    if (content.price < STRIPE_MIN_CHARGE_CENTS) {
      return NextResponse.json({ hasAccess: false, reason: "price_below_minimum" }, { status: 400 });
    }

    if (body.data.paymentIntentId) {
      return finalizePurchase({
        userId: user.id,
        contentId: content.id,
        price: content.price,
        paymentIntentId: body.data.paymentIntentId,
      });
    }

    return beginPurchase({
      userId: user.id,
      contentId: content.id,
      price: content.price,
    });
  } catch (error) {
    console.error("content purchase failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ hasAccess: false, reason: "unavailable" }, { status: 500 });
  }
}

async function beginPurchase(input: { userId: string; contentId: string; price: number }) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, status, amount_cents, stripe_payment_intent_id, user_id, content_id")
    .eq("user_id", input.userId)
    .eq("content_id", input.contentId)
    .in("status", ["pending", "succeeded"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const transactions = z.array(transactionSchema).parse(data ?? []);
  const succeeded = transactions.find((transaction) => transaction.status === "succeeded");
  if (succeeded) {
    return NextResponse.json({ hasAccess: true, reason: "purchased", duplicate: true });
  }

  const pending = transactions.find((transaction) => transaction.status === "pending");
  if (pending?.stripe_payment_intent_id) {
    const stripe = getStripe();
    const existing = await stripe.paymentIntents.retrieve(pending.stripe_payment_intent_id);
    if (existing.status === "succeeded") {
      return grantPurchase({
        userId: input.userId,
        contentId: input.contentId,
        transactionId: pending.id,
        amount: input.price,
      });
    }
    if (existing.status !== "canceled" && existing.client_secret) {
      return NextResponse.json({
        hasAccess: false,
        reason: "payment_required",
        clientSecret: existing.client_secret,
        paymentIntentId: existing.id,
      });
    }
    await supabase
      .from("transactions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", pending.id);
  }

  const transactionId = pending && !pending.stripe_payment_intent_id ? pending.id : crypto.randomUUID();
  if (!pending || pending.stripe_payment_intent_id) {
    const { error: insertError } = await supabase.from("transactions").insert({
      id: transactionId,
      user_id: input.userId,
      content_id: input.contentId,
      amount_cents: input.price,
      status: "pending",
    });
    if (insertError) throw new Error(insertError.message);
  }

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: input.price,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: input.userId,
        contentId: input.contentId,
        transactionId,
        purpose: "content_purchase",
      },
    });

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        stripe_payment_intent_id: intent.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .eq("user_id", input.userId);

    if (updateError) throw new Error(updateError.message);
    if (!intent.client_secret) {
      return NextResponse.json({ hasAccess: false, reason: "payment_unavailable" }, { status: 502 });
    }

    return NextResponse.json({
      hasAccess: false,
      reason: "payment_required",
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    });
  } catch (error) {
    await supabase
      .from("transactions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", transactionId);
    throw error;
  }
}

async function finalizePurchase(input: {
  userId: string;
  contentId: string;
  price: number;
  paymentIntentId: string;
}) {
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
  if (intent.metadata.purpose !== "content_purchase") {
    return NextResponse.json({ hasAccess: false, reason: "invalid_payment" }, { status: 400 });
  }
  if (intent.metadata.userId !== input.userId) {
    return NextResponse.json({ hasAccess: false, reason: "forbidden" }, { status: 403 });
  }
  if (intent.metadata.contentId !== input.contentId) {
    return NextResponse.json({ hasAccess: false, reason: "invalid_payment" }, { status: 400 });
  }
  if (intent.amount !== input.price || intent.currency !== "usd") {
    return NextResponse.json({ hasAccess: false, reason: "price_mismatch" }, { status: 400 });
  }
  if (intent.status !== "succeeded") {
    return NextResponse.json({ hasAccess: false, reason: "payment_incomplete" }, { status: 402 });
  }

  const transactionId = z.string().uuid().safeParse(intent.metadata.transactionId);
  if (!transactionId.success) {
    return NextResponse.json({ hasAccess: false, reason: "invalid_payment" }, { status: 400 });
  }
  return grantPurchase({
    userId: input.userId,
    contentId: input.contentId,
    transactionId: transactionId.data,
    amount: input.price,
  });
}

async function grantPurchase(input: {
  userId: string;
  contentId: string;
  transactionId: string;
  amount: number;
}) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, status, amount_cents, stripe_payment_intent_id, user_id, content_id")
    .eq("id", input.transactionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return NextResponse.json({ hasAccess: false, reason: "invalid_payment" }, { status: 400 });
  }
  const transaction = transactionSchema.parse(data);
  if (transaction.user_id !== input.userId || transaction.content_id !== input.contentId) {
    return NextResponse.json({ hasAccess: false, reason: "forbidden" }, { status: 403 });
  }
  if (transaction.amount_cents !== input.amount) {
    return NextResponse.json({ hasAccess: false, reason: "price_mismatch" }, { status: 400 });
  }
  if (transaction.status === "succeeded") {
    return NextResponse.json({ hasAccess: true, reason: "purchased", duplicate: true });
  }

  const { data: updated, error: updateError } = await supabase
    .from("transactions")
    .update({ status: "succeeded", updated_at: new Date().toISOString() })
    .eq("id", transaction.id)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json({ hasAccess: true, reason: "purchased", duplicate: true });
    }
    throw new Error(updateError.message);
  }
  if (!updated || updated.length === 0) {
    const { data: latest, error: latestError } = await supabase
      .from("transactions")
      .select("status")
      .eq("id", transaction.id)
      .maybeSingle();
    if (latestError) throw new Error(latestError.message);
    const status = z.object({ status: z.enum(["pending", "succeeded", "failed"]) }).safeParse(latest);
    if (status.success && status.data.status === "succeeded") {
      return NextResponse.json({ hasAccess: true, reason: "purchased", duplicate: true });
    }
    return NextResponse.json({ hasAccess: false, reason: "payment_incomplete" }, { status: 402 });
  }

  try {
    await writeAuditLog({
      actorId: input.userId,
      action: "create",
      entity: "transaction",
      entityId: transaction.id,
      metadata: { contentId: input.contentId, amountCents: input.amount, status: "succeeded" },
    });
  } catch (auditError) {
    console.error("audit log failed after purchase", auditError instanceof Error ? auditError.message : "unknown");
  }

  return NextResponse.json({ hasAccess: true, reason: "purchased" });
}
