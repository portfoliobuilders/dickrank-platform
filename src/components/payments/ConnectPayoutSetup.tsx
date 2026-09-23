'use client';

import { useEffect, useState } from 'react';
import { loadConnectAndInitialize, type StripeConnectInstance } from '@stripe/connect-js/pure';
import { ConnectComponentsProvider, ConnectNotificationBanner } from '@stripe/react-connect-js';

export function ConnectPayoutSetup() {
  const [urlLoading, setUrlLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connect, setConnect] = useState<StripeConnectInstance | null>(null);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!publishableKey) return;
    const instance = loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: async () => {
        const response = await fetch('/api/payments/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'account_session' }),
        });
        const data = (await response.json()) as { clientSecret?: string; error?: string };
        if (!response.ok || !data.clientSecret) {
          throw new Error(data.error || 'Payout setup is unavailable');
        }
        return data.clientSecret;
      },
    });
    setConnect(instance);
  }, [publishableKey]);

  async function startHostedOnboarding() {
    setUrlLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/payments/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'onboarding_link' }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error || 'Could not start payout setup');
        setUrlLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Could not start payout setup');
      setUrlLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 p-5">
      <div>
        <h2 className="text-lg font-semibold">Payout setup</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Stripe verifies your identity and bank account before payouts. The banner below shows anything Stripe still needs.
        </p>
      </div>
      {connect ? (
        <ConnectComponentsProvider connectInstance={connect}>
          <ConnectNotificationBanner />
        </ConnectComponentsProvider>
      ) : null}
      <button
        type="button"
        onClick={startHostedOnboarding}
        disabled={urlLoading}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
      >
        {urlLoading ? 'Opening Stripe…' : 'Verify identity and bank account'}
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </section>
  );
}
