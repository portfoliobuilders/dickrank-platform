'use client';

import { useEffect, useState } from 'react';
import { ConnectPayoutSetup } from '@/components/payments/ConnectPayoutSetup';

export default function OnboardingPage() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const refresh = new URLSearchParams(window.location.search).get('refresh');
    if (refresh !== '1') return;
    let cancelled = false;
    fetch('/api/payments/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'onboarding_link' }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !data.url) {
          if (!cancelled) setMessage(data.error || 'Could not refresh payout setup');
          return;
        }
        window.location.href = data.url;
      })
      .catch(() => {
        if (!cancelled) setMessage('Could not refresh payout setup');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="space-y-4">
      <h1 className="text-3xl font-semibold">Payout onboarding</h1>
      {message ? <p className="text-sm text-red-300">{message}</p> : null}
      <ConnectPayoutSetup />
    </main>
  );
}
