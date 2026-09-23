import {
  bestSubscriptionDecision,
  type SubscriptionAccessInput,
} from "@/lib/subscription-access";

export const contentAccessTypes = ["public", "premium", "purchase"] as const;
export type ContentAccessType = (typeof contentAccessTypes)[number];

export interface AccessPolicyInput {
  authenticated: boolean;
  ageVerified: boolean;
  accessType: ContentAccessType;
  /** One-time price in cents. Null when the post is not sold individually. */
  price: number | null;
  subscriptions: SubscriptionAccessInput[];
  hasPurchase: boolean;
}

export interface AccessPolicyResult {
  hasAccess: boolean;
  reason: string;
}

export function isIndividuallyPurchasable(price: number | null, accessType: ContentAccessType): boolean {
  return typeof price === "number" && price > 0 && (accessType === "purchase" || accessType === "premium");
}

/**
 * Public posts are allowed for age-verified members.
 * Premium posts require a creator subscription (including grace and
 * cancelled-until-endDate). Purchased posts require a succeeded transaction.
 * A premium post with a price can be unlocked either way.
 */
export function decideContentAccess(input: AccessPolicyInput, now = new Date()): AccessPolicyResult {
  if (!input.authenticated) {
    return { hasAccess: false, reason: "unauthenticated" };
  }
  if (!input.ageVerified) {
    return { hasAccess: false, reason: "age_verification_required" };
  }
  if (input.accessType === "public") {
    return { hasAccess: true, reason: "public" };
  }

  const purchasable = isIndividuallyPurchasable(input.price, input.accessType);

  if (input.accessType === "premium") {
    const subscription = bestSubscriptionDecision(input.subscriptions, now);
    if (subscription.allowed) {
      return { hasAccess: true, reason: subscription.reason };
    }
    if (input.hasPurchase && purchasable) {
      return { hasAccess: true, reason: "purchased" };
    }
    if (purchasable) {
      return { hasAccess: false, reason: "subscription_or_purchase_required" };
    }
    return { hasAccess: false, reason: subscription.reason };
  }

  if (input.hasPurchase) {
    return { hasAccess: true, reason: "purchased" };
  }
  return { hasAccess: false, reason: "purchase_required" };
}
