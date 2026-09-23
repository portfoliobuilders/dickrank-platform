import assert from "node:assert/strict";
import test from "node:test";
import { decideContentAccess } from "./access-policy";
import {
  bestSubscriptionDecision,
  GRACE_PERIOD_DAYS,
  gracePeriodEndsAt,
  hasSubscriptionAccess,
} from "./subscription-guard";

const failedAt = "2026-01-01T00:00:00.000Z";
const justInsideGrace = new Date(new Date(failedAt).getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000 - 1);
const graceExactEnd = gracePeriodEndsAt(failedAt);
const afterGrace = new Date(graceExactEnd.getTime() + 1);

test("active subscription grants access", () => {
  const decision = hasSubscriptionAccess({
    status: "ACTIVE",
    endDate: null,
    paymentFailedAt: null,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "subscribed");
});

test("cancelled subscription keeps access until endDate", () => {
  const decision = hasSubscriptionAccess(
    {
      status: "CANCELLED",
      endDate: "2026-02-01T00:00:00.000Z",
      paymentFailedAt: null,
    },
    new Date("2026-01-15T00:00:00.000Z"),
  );
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "cancelled_until_end");
});

test("cancelled subscription ends at endDate", () => {
  const decision = hasSubscriptionAccess(
    {
      status: "CANCELLED",
      endDate: "2026-02-01T00:00:00.000Z",
      paymentFailedAt: null,
    },
    new Date("2026-02-01T00:00:00.000Z"),
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "subscription_ended");
});

test("failed payment keeps access for 3 days and stops at the boundary", () => {
  const subscription = {
    status: "PAST_DUE" as const,
    endDate: null,
    paymentFailedAt: failedAt,
  };
  assert.equal(hasSubscriptionAccess(subscription, justInsideGrace).reason, "grace_period");
  assert.equal(hasSubscriptionAccess(subscription, graceExactEnd).allowed, false);
  assert.equal(hasSubscriptionAccess(subscription, graceExactEnd).reason, "grace_period_expired");
  assert.equal(hasSubscriptionAccess(subscription, afterGrace).reason, "grace_period_expired");
});

test("past due without a failure timestamp does not grant access", () => {
  const decision = hasSubscriptionAccess({
    status: "PAST_DUE",
    endDate: null,
    paymentFailedAt: null,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "payment_failed");
});

test("best subscription prefers an active plan over an expired one", () => {
  const decision = bestSubscriptionDecision([
    { status: "EXPIRED", endDate: null, paymentFailedAt: null },
    { status: "ACTIVE", endDate: null, paymentFailedAt: null },
  ]);
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "subscribed");
});

test("public posts require sign-in and age verification", () => {
  assert.equal(
    decideContentAccess({
      authenticated: false,
      ageVerified: false,
      accessType: "public",
      price: null,
      subscriptions: [],
      hasPurchase: false,
    }).reason,
    "unauthenticated",
  );
  assert.equal(
    decideContentAccess({
      authenticated: true,
      ageVerified: false,
      accessType: "public",
      price: null,
      subscriptions: [],
      hasPurchase: false,
    }).reason,
    "age_verification_required",
  );
  assert.equal(
    decideContentAccess({
      authenticated: true,
      ageVerified: true,
      accessType: "public",
      price: null,
      subscriptions: [],
      hasPurchase: false,
    }).hasAccess,
    true,
  );
});

test("premium posts allow a subscription, a grace period, or a one-time purchase", () => {
  const base = {
    authenticated: true,
    ageVerified: true,
    accessType: "premium" as const,
    price: 500,
    hasPurchase: false,
  };
  assert.equal(
    decideContentAccess({
      ...base,
      subscriptions: [{ status: "ACTIVE", endDate: null, paymentFailedAt: null }],
    }).reason,
    "subscribed",
  );
  assert.equal(
    decideContentAccess(
      {
        ...base,
        subscriptions: [{ status: "PAST_DUE", endDate: null, paymentFailedAt: failedAt }],
      },
      justInsideGrace,
    ).reason,
    "grace_period",
  );
  assert.equal(
    decideContentAccess({
      ...base,
      hasPurchase: true,
      subscriptions: [],
    }).reason,
    "purchased",
  );
  assert.equal(
    decideContentAccess({
      ...base,
      price: null,
      subscriptions: [],
    }).reason,
    "subscription_required",
  );
});

test("purchase-only posts ignore subscriptions and require a transaction", () => {
  assert.equal(
    decideContentAccess({
      authenticated: true,
      ageVerified: true,
      accessType: "purchase",
      price: 700,
      subscriptions: [{ status: "ACTIVE", endDate: null, paymentFailedAt: null }],
      hasPurchase: false,
    }).reason,
    "purchase_required",
  );
  assert.equal(
    decideContentAccess({
      authenticated: true,
      ageVerified: true,
      accessType: "purchase",
      price: 700,
      subscriptions: [],
      hasPurchase: true,
    }).hasAccess,
    true,
  );
});
