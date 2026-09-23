import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { gracePeriodEndsAt, subscriptionStatuses } from "@/lib/subscription-access";
import { getServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  subscriptionId: z.string().uuid(),
});

const subscriptionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(subscriptionStatuses),
  end_date: z.string().nullable(),
  renewal_date: z.string().nullable(),
  payment_failed_at: z.string().nullable(),
  stripe_subscription_id: z.string().nullable(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, user_id, status, end_date, renewal_date, payment_failed_at, stripe_subscription_id")
      .eq("id", body.data.subscriptionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const subscription = subscriptionSchema.parse(data);
    if (subscription.user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (subscription.status === "CANCELLED") {
      return NextResponse.json({
        ok: true,
        status: "CANCELLED",
        endDate: subscription.end_date,
        duplicate: true,
      });
    }

    let endDate = subscription.end_date ?? subscription.renewal_date;
    if (subscription.stripe_subscription_id) {
      const stripe = getStripe();
      const updated = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      if (updated.current_period_end) {
        endDate = new Date(updated.current_period_end * 1000).toISOString();
      }
    }

    if (subscription.status === "PAST_DUE" && subscription.payment_failed_at) {
      const graceEnd = gracePeriodEndsAt(subscription.payment_failed_at).toISOString();
      if (!endDate || new Date(graceEnd).getTime() < new Date(endDate).getTime()) {
        endDate = graceEnd;
      }
    }

    if (!endDate) {
      endDate = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "CANCELLED",
        end_date: endDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .eq("user_id", user.id);

    if (updateError) throw new Error(updateError.message);

    await writeAuditLog({
      actorId: user.id,
      action: "update",
      entity: "subscription",
      entityId: subscription.id,
      metadata: { status: "CANCELLED", endDate },
    });

    return NextResponse.json({ ok: true, status: "CANCELLED", endDate });
  } catch (error) {
    console.error("subscription cancel failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
