import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SubscriptionList } from "./SubscriptionList";

test("subscription list shows monthly amount, renewal, creator link, and cancel", () => {
  const html = renderToStaticMarkup(
    <SubscriptionList
      subscriptions={[
        {
          id: "44444444-4444-4444-8444-444444444444",
          creatorName: "Ada",
          creatorPath: "/creators/ada",
          amountCents: 1200,
          status: "ACTIVE",
          renewalDate: "2026-04-01T00:00:00.000Z",
          endDate: "2026-04-01T00:00:00.000Z",
          paymentFailedAt: null,
        },
      ]}
    />,
  );
  assert.match(html, /Ada/);
  assert.match(html, /href="\/creators\/ada"/);
  assert.match(html, /\$12\.00/);
  assert.match(html, /\/ month/);
  assert.match(html, /Renews on Apr 1, 2026/);
  assert.match(html, />Cancel</);
});

test("past-due subscription shows the grace-period end date", () => {
  const html = renderToStaticMarkup(
    <SubscriptionList
      subscriptions={[
        {
          id: "55555555-5555-4555-8555-555555555555",
          creatorName: "Bea",
          creatorPath: "/creators/bea",
          amountCents: 800,
          status: "PAST_DUE",
          renewalDate: null,
          endDate: null,
          paymentFailedAt: "2026-03-01T00:00:00.000Z",
        },
      ]}
    />,
  );
  assert.match(html, /Grace period ends Mar 4, 2026/);
  assert.match(html, /Payment failed/);
});
