"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Paywall } from "@/components/content/Paywall";
import { contentAccessTypes } from "@/lib/access-policy";
import type { AccessResponse } from "@/types/access";

const previewSchema = z.object({
  contentId: z.string().uuid(),
  title: z.string(),
  previewText: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  price: z.number().int().nullable(),
  accessType: z.enum(contentAccessTypes),
  creator: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    profilePath: z.string(),
  }),
  tiers: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      priceCents: z.number().int(),
      features: z.array(z.string()),
      popular: z.boolean(),
    }),
  ),
});

const accessResponseSchema = z.object({
  hasAccess: z.boolean(),
  reason: z.string().optional(),
  preview: previewSchema.optional(),
});

export function ContentGuard({
  contentId,
  children,
}: {
  contentId: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [access, setAccess] = useState<AccessResponse | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(`/api/content/${contentId}/access`, { cache: "no-store" });
      const json: unknown = await response.json();
      const parsed = accessResponseSchema.safeParse(json);
      if (!parsed.success) {
        setStatus("error");
        return;
      }
      setAccess(parsed.data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [contentId]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const params = new URLSearchParams(window.location.search);
      const paymentIntent = params.get("payment_intent");
      const redirectStatus = params.get("redirect_status");
      const storedContentId = sessionStorage.getItem("content-purchase-id");
      if (paymentIntent && redirectStatus === "succeeded" && storedContentId === contentId) {
        sessionStorage.removeItem("content-purchase-id");
        await fetch(`/api/content/${contentId}/purchase`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paymentIntentId: paymentIntent }),
        });
        params.delete("payment_intent");
        params.delete("payment_intent_client_secret");
        params.delete("redirect_status");
        const next = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}`;
        window.history.replaceState({}, "", next);
      }
      if (!cancelled) await load();
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [contentId, load]);

  if (status === "loading") {
    return (
      <div role="status" className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-300">
        Checking your access…
      </div>
    );
  }

  if (status === "error" || !access) {
    return (
      <div role="alert" className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
        <p className="text-zinc-200">We couldn't check access to this post.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Try again
        </button>
      </div>
    );
  }

  if (access.reason === "unauthenticated") {
    return (
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
        <h2 className="text-xl font-semibold">Sign in to view this post</h2>
        <a href="/login" className="mt-4 inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950">
          Sign in
        </a>
      </section>
    );
  }

  if (access.reason === "age_verification_required") {
    return (
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
        <h2 className="text-xl font-semibold">Age verification required</h2>
        <p className="mt-2 text-zinc-300">Confirm you are 18 or older before viewing posts.</p>
        <a href="/verify-age" className="mt-4 inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950">
          Verify age
        </a>
      </section>
    );
  }

  if (!access.hasAccess) {
    if (!access.preview) {
      return (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
          <h2 className="text-xl font-semibold">This post is locked</h2>
          <p className="mt-2 text-zinc-300">Subscribe to the creator to view it.</p>
        </section>
      );
    }
    return <Paywall preview={access.preview} reason={access.reason} onPurchased={() => void load()} />;
  }

  return (
    <div>
      {access.reason === "grace_period" ? (
        <p className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A recent payment failed. You can still view this post during the 3-day grace period. Update your card to keep access.
        </p>
      ) : null}
      {children}
    </div>
  );
}
