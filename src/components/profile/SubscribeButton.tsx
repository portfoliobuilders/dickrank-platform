"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function SubscribeButton({
  username,
  initialSubscribed,
  onDelta,
  onCount,
}: {
  username: string;
  initialSubscribed: boolean;
  onDelta?: (delta: number) => void;
  onCount?: (count: number) => void;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (pending) return;
    const previous = subscribed;
    const next = !subscribed;
    setSubscribed(next);
    onDelta?.(next ? 1 : -1);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/creators/${username}/subscribe`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as {
        subscribed?: boolean;
        followerCount?: number;
        error?: string;
      };
      if (!response.ok || typeof body.subscribed !== "boolean") {
        throw new Error(body.error || "Could not update subscription");
      }
      setSubscribed(body.subscribed);
      if (typeof body.followerCount === "number") onCount?.(body.followerCount);
    } catch (caught) {
      setSubscribed(previous);
      onDelta?.(next ? -1 : 1);
      setError(caught instanceof Error ? caught.message : "Could not update subscription");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button variant={subscribed ? "secondary" : "primary"} aria-pressed={subscribed} onClick={() => void toggle()}>
        {subscribed ? "Subscribed" : "Subscribe"}
      </Button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
