import { NextResponse } from "next/server";
import { z } from "zod";
import { bestSubscriptionDecision, subscriptionStatuses } from "@/lib/subscription-access";
import { getServiceSupabase } from "@/lib/supabase/server";

export {
  GRACE_PERIOD_DAYS,
  bestSubscriptionDecision,
  gracePeriodEndsAt,
  hasSubscriptionAccess,
  subscriptionStatuses,
} from "@/lib/subscription-access";
export type {
  SubscriptionAccessInput,
  SubscriptionDecision,
  SubscriptionStatus,
} from "@/lib/subscription-access";

const idSchema = z.string().uuid();

const subscriptionRowSchema = z.object({
  status: z.enum(subscriptionStatuses),
  end_date: z.string().nullable(),
  payment_failed_at: z.string().nullable(),
});

/**
 * API-route guard. Returns a 403 response when the user has no usable
 * subscription to the creator. Grace period and cancelled-until-endDate
 * both count as access. Returns null when the request may continue.
 *
 * const denied = await subscriptionGuard(userId, creatorId);
 * if (denied) return denied;
 */
export async function subscriptionGuard(
  userId: string,
  creatorId: string,
): Promise<NextResponse | null> {
  if (!idSchema.safeParse(userId).success || !idSchema.safeParse(creatorId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, end_date, payment_failed_at")
    .eq("user_id", userId)
    .eq("creator_id", creatorId);

  if (error) {
    console.error("subscription lookup failed", error.message);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }

  const parsed = z.array(subscriptionRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("subscription row validation failed");
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }

  const decision = bestSubscriptionDecision(
    parsed.data.map((row) => ({
      status: row.status,
      endDate: row.end_date,
      paymentFailedAt: row.payment_failed_at,
    })),
  );

  if (decision.allowed) return null;

  return NextResponse.json({ error: decision.reason }, { status: 403 });
}
