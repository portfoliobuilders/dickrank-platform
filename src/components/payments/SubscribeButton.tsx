'use client';

import { useState } from 'react';
import { rememberPendingSubscription } from '@/components/analytics/SubscriptionSuccessTracker';

export function SubscribeButton({
  creatorId,
  tierId,
  tierName,
  price,
}: {
  creatorId: string;
  tierId: string;
  tierName: string;
  price: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, tierId }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error || 'Checkout could not be started');
        setLoading(false);
        return;
      }
      rememberPendingSubscription(creatorId, tierName, price);
      window.location.href = data.url;
    } catch {
      setError('Checkout could not be started');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={subscribe}
        disabled={loading}
        className="w-full rounded-lg bg-amber-400 px-4 py-2 font-medium text-zinc-950 disabled:opacity-60"
      >
        {loading ? 'Redirecting…' : 'Subscribe'}
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
