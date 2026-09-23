/** Days of access kept after a failed renewal payment. */
export const GRACE_PERIOD_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export const subscriptionStatuses = [
  "ACTIVE",
  "CANCELLED",
  "PAST_DUE",
  "INCOMPLETE",
  "EXPIRED",
] as const;

export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export interface SubscriptionAccessInput {
  status: SubscriptionStatus;
  endDate: string | null;
  paymentFailedAt: string | null;
}

export interface SubscriptionDecision {
  allowed: boolean;
  reason: string;
}

export function gracePeriodEndsAt(paymentFailedAt: string): Date {
  const failedAt = new Date(paymentFailedAt);
  return new Date(failedAt.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
}

/**
 * A subscription grants access when it is active, cancelled but not yet
 * at endDate, or past due and still inside the 3-day grace window.
 * The grace window ends at the instant paymentFailedAt + 3 days is reached.
 */
export function hasSubscriptionAccess(
  subscription: SubscriptionAccessInput | null,
  now = new Date(),
): SubscriptionDecision {
  if (!subscription) {
    return { allowed: false, reason: "subscription_required" };
  }

  if (subscription.status === "ACTIVE") {
    return { allowed: true, reason: "subscribed" };
  }

  if (subscription.status === "CANCELLED") {
    if (subscription.endDate && new Date(subscription.endDate).getTime() > now.getTime()) {
      return { allowed: true, reason: "cancelled_until_end" };
    }
    return { allowed: false, reason: "subscription_ended" };
  }

  if (subscription.status === "PAST_DUE") {
    if (!subscription.paymentFailedAt) {
      return { allowed: false, reason: "payment_failed" };
    }
    const graceEnd = gracePeriodEndsAt(subscription.paymentFailedAt);
    if (now.getTime() < graceEnd.getTime()) {
      return { allowed: true, reason: "grace_period" };
    }
    return { allowed: false, reason: "grace_period_expired" };
  }

  return { allowed: false, reason: "subscription_required" };
}

const denialPriority = [
  "grace_period_expired",
  "payment_failed",
  "subscription_ended",
  "subscription_required",
];

export function bestSubscriptionDecision(
  subscriptions: SubscriptionAccessInput[],
  now = new Date(),
): SubscriptionDecision {
  const decisions = subscriptions.map((subscription) => hasSubscriptionAccess(subscription, now));
  const allowed = decisions.find((decision) => decision.allowed);
  if (allowed) return allowed;

  for (const reason of denialPriority) {
    const match = decisions.find((decision) => decision.reason === reason);
    if (match) return match;
  }

  return { allowed: false, reason: "subscription_required" };
}
