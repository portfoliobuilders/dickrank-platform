"use client";

import { useState } from "react";
import { formatDate, formatUsd } from "@/lib/format";
import { gracePeriodEndsAt, type SubscriptionStatus } from "@/lib/subscription-access";

export interface SubscriptionView {
  id: string;
  creatorName: string;
  creatorPath: string;
  amountCents: number;
  status: SubscriptionStatus;
  renewalDate: string | null;
  endDate: string | null;
  paymentFailedAt: string | null;
}

export function SubscriptionList({ subscriptions }: { subscriptions: SubscriptionView[] }) {
  if (subscriptions.length === 0) {
    return (
      <p className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-zinc-300">
        You have no active subscriptions.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {subscriptions.map((subscription) => (
        <li key={subscription.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <a href={subscription.creatorPath} className="text-lg font-semibold text-white hover:text-amber-300">
                {subscription.creatorName}
              </a>
              <p className="mt-1 text-sm text-zinc-400">Creator profile</p>
            </div>
            <p className="text-lg font-semibold text-white">
              {formatUsd(subscription.amountCents)}
              <span className="text-sm font-normal text-zinc-400"> / month</span>
            </p>
          </div>
          <p className="mt-4 text-sm text-zinc-200">{scheduleCopy(subscription)}</p>
          {subscription.status === "PAST_DUE" && subscription.paymentFailedAt ? (
            <p className="mt-2 text-sm text-amber-200">
              Payment failed. Access continues until {formatDate(gracePeriodEndsAt(subscription.paymentFailedAt).toISOString())}.
            </p>
          ) : null}
          {subscription.status === "ACTIVE" || subscription.status === "PAST_DUE" ? (
            <CancelSubscriptionButton subscription={subscription} />
          ) : (
            <p className="mt-4 text-sm text-zinc-400">Cancelled. Access stays on until the date above.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function scheduleCopy(subscription: SubscriptionView): string {
  if (subscription.status === "CANCELLED" && subscription.endDate) {
    return `Access until ${formatDate(subscription.endDate)}`;
  }
  if (subscription.status === "PAST_DUE" && subscription.paymentFailedAt) {
    return `Grace period ends ${formatDate(gracePeriodEndsAt(subscription.paymentFailedAt).toISOString())}`;
  }
  if (subscription.renewalDate) {
    return `Renews on ${formatDate(subscription.renewalDate)}`;
  }
  return "Renewal date will appear after the next successful payment.";
}

function CancelSubscriptionButton({ subscription }: { subscription: SubscriptionView }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepUntil = subscription.endDate ?? subscription.renewalDate;

  async function confirmCancel() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.id }),
      });
      if (!response.ok) {
        setError("We couldn't cancel this subscription. It is still active.");
        setPending(false);
        return;
      }
      setOpen(false);
      window.location.reload();
    } catch {
      setError("We couldn't cancel this subscription. It is still active.");
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-zinc-400"
      >
        Cancel
      </button>
      {open ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`cancel-${subscription.id}`}
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
          >
            <h3 id={`cancel-${subscription.id}`} className="text-lg font-semibold text-white">
              Cancel {subscription.creatorName}?
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              {keepUntil
                ? `You keep access until ${formatDate(keepUntil)}. The subscription will not renew after that.`
                : "You keep access through the end of the current paid period."}
            </p>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-sm text-zinc-200"
              >
                Keep subscription
              </button>
              <button
                type="button"
                onClick={() => void confirmCancel()}
                disabled={pending}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Cancelling…" : "Confirm cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
