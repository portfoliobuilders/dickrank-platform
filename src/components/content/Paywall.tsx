"use client";

import { FormEvent, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { PricingCard } from "@/components/payments/PricingCard";
import { isIndividuallyPurchasable } from "@/lib/access-policy";
import { formatUsd } from "@/lib/format";
import type { ContentPreview } from "@/types/access";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise: Promise<Stripe | null> | null = publishableKey ? loadStripe(publishableKey) : null;

export interface PaywallProps {
  preview: ContentPreview;
  reason?: string;
  onPurchased?: () => void;
}

export function Paywall({ preview, reason, onPurchased }: PaywallProps) {
  const purchasable = isIndividuallyPurchasable(preview.price, preview.accessType);
  const initial = preview.creator.displayName.slice(0, 1).toUpperCase();

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950" aria-label="Locked post">
      <div className="relative h-64 overflow-hidden bg-zinc-900">
        {preview.thumbnailUrl ? (
          <img
            src={preview.thumbnailUrl}
            alt=""
            className="h-full w-full scale-110 object-cover blur-2xl"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Preview</p>
          <p aria-hidden="true" className="mt-3 max-w-md select-none text-lg text-white blur-md">
            {preview.previewText || preview.title}
          </p>
          <p className="mt-4 text-sm text-zinc-200">The full post stays hidden until you unlock it.</p>
        </div>
      </div>

      <div className="space-y-8 px-6 py-8">
        <div className="flex items-center gap-4">
          {preview.creator.avatarUrl ? (
            <img
              src={preview.creator.avatarUrl}
              alt={`${preview.creator.displayName} avatar`}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-lg font-semibold">
              {initial}
            </div>
          )}
          <div>
            <p className="text-sm text-zinc-400">Posted by</p>
            <a href={preview.creator.profilePath} className="text-lg font-semibold text-white hover:text-amber-300">
              {preview.creator.displayName}
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">{preview.title}</h2>
          <p className="text-zinc-300">
            {reason === "grace_period_expired"
              ? "Your payment failed and the 3-day grace period has ended."
              : "Subscribe to view this post, or buy it once if the creator offers that."}
          </p>
          <a
            href="#subscribe"
            className="inline-flex rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
          >
            Subscribe to view
          </a>
        </div>

        <div id="subscribe" className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Subscription tiers</h3>
          {preview.tiers.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {preview.tiers.map((tier) => (
                <PricingCard
                  key={tier.id}
                  name={tier.name}
                  priceCents={tier.priceCents}
                  features={tier.features}
                  popular={tier.popular}
                  ctaLabel="Subscribe"
                  href={`${preview.creator.profilePath}?tier=${tier.id}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">This creator has not published subscription tiers yet.</p>
          )}
        </div>

        {purchasable && preview.price ? (
          <OneTimePurchase
            contentId={preview.contentId}
            priceCents={preview.price}
            onPurchased={onPurchased}
          />
        ) : null}
      </div>
    </section>
  );
}

function OneTimePurchase({
  contentId,
  priceCents,
  onPurchased,
}: {
  contentId: string;
  priceCents: number;
  onPurchased?: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function startCheckout() {
    setPending(true);
    setError(null);
    sessionStorage.setItem("content-purchase-id", contentId);
    try {
      const response = await fetch(`/api/content/${contentId}/purchase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body: { hasAccess?: boolean; clientSecret?: string; reason?: string } = await response.json();
      if (body.hasAccess) {
        onPurchased?.();
        return;
      }
      if (!response.ok || !body.clientSecret) {
        setError("We couldn't start checkout. Nothing was charged.");
        setPending(false);
        return;
      }
      setClientSecret(body.clientSecret);
      setPending(false);
    } catch {
      setError("We couldn't start checkout. Nothing was charged.");
      setPending(false);
    }
  }

  async function finalize(paymentIntentId: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/content/${contentId}/purchase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
      const body: { hasAccess?: boolean } = await response.json();
      if (body.hasAccess) {
        onPurchased?.();
        return;
      }
      setError("The payment is still processing. Refresh in a moment if the post stays locked.");
      setPending(false);
    } catch {
      setError("The payment is still processing. Refresh in a moment if the post stays locked.");
      setPending(false);
    }
  }

  return (
    <div id="purchase" className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-lg font-semibold text-white">One-time purchase</h3>
      <p className="mt-1 text-sm text-zinc-300">Unlock this post for {formatUsd(priceCents)} without a subscription.</p>
      {clientSecret && stripePromise ? (
        <div className="mt-4">
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
            <CardForm onComplete={finalize} />
          </Elements>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void startCheckout()}
          disabled={pending}
          className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {pending ? "Starting checkout…" : `Unlock for ${formatUsd(priceCents)}`}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CardForm({ onComplete }: { onComplete: (paymentIntentId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    if (result.error) {
      setError(result.error.message ?? "The card was declined.");
      setPending(false);
      return;
    }
    if (result.paymentIntent?.status === "succeeded") {
      onComplete(result.paymentIntent.id);
      return;
    }
    setError("Your bank needs another confirmation step.");
    setPending(false);
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <PaymentElement />
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!stripe || pending}
        className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {pending ? "Processing…" : "Pay now"}
      </button>
    </form>
  );
}
