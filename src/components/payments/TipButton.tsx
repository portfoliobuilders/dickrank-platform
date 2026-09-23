'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { formatUsd, MAX_TIP_CENTS, MIN_TIP_CENTS, TIP_PRESETS_CENTS } from '@/lib/payments/money';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export function TipButton({ creatorId }: { creatorId: string }) {
  const [open, setOpen] = useState(false);
  const [amountCents, setAmountCents] = useState<number>(1000);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [open]);

  function close() {
    setOpen(false);
    setClientSecret(null);
    setSuccess(false);
    setError(null);
    setLoading(false);
  }

  function selectPreset(cents: number) {
    setAmountCents(cents);
    setCustom('');
    setError(null);
  }

  function onCustom(value: string) {
    setCustom(value);
    const dollars = Number(value);
    if (!value) return;
    if (!Number.isFinite(dollars)) return;
    setAmountCents(Math.round(dollars * 100));
  }

  async function startPayment(event: FormEvent) {
    event.preventDefault();
    if (amountCents < MIN_TIP_CENTS || amountCents > MAX_TIP_CENTS) {
      setError('Tips must be between $1 and $500');
      return;
    }
    if (!stripePromise) {
      setError('Card payments are not configured');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/payments/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, amountCents, idempotencyKey }),
      });
      const data = (await response.json()) as { clientSecret?: string; error?: string };
      if (!response.ok || !data.clientSecret) {
        setError(data.error || 'Could not start the tip');
        setLoading(false);
        return;
      }
      setClientSecret(data.clientSecret);
      setLoading(false);
    } catch {
      setError('Could not start the tip');
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm"
      >
        Send a tip
      </button>
      {open ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold">Send a tip</h2>
              <button type="button" onClick={close} className="text-sm text-zinc-400">
                Close
              </button>
            </div>
            {success ? (
              <p className="rounded-lg bg-emerald-950 px-3 py-3 text-emerald-200">
                Tip sent. The creator is credited when Stripe confirms the payment.
              </p>
            ) : clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                <TipConfirmation
                  amountCents={amountCents}
                  onSuccess={() => setSuccess(true)}
                  onError={setError}
                />
                {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
              </Elements>
            ) : (
              <form onSubmit={startPayment} className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {TIP_PRESETS_CENTS.map((cents) => (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => selectPreset(cents)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        amountCents === cents && !custom ? 'border-amber-400 text-amber-200' : 'border-zinc-700'
                      }`}
                    >
                      {formatUsd(cents)}
                    </button>
                  ))}
                </div>
                <label className="block text-sm text-zinc-300">
                  Custom amount
                  <input
                    inputMode="decimal"
                    value={custom}
                    onChange={(event) => onCustom(event.target.value)}
                    placeholder="25.00"
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                  />
                </label>
                <p className="text-sm text-zinc-400">You will confirm {formatUsd(amountCents)} on the next step.</p>
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-amber-400 px-4 py-2 font-medium text-zinc-950 disabled:opacity-60"
                >
                  {loading ? 'Starting…' : 'Continue to payment'}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function TipConfirmation({
  amountCents,
  onSuccess,
  onError,
}: {
  amountCents: number;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const result = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (result.error) {
      onError(result.error.message || 'Payment was not completed');
      setLoading(false);
      return;
    }
    onSuccess();
    setLoading(false);
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <p className="text-sm text-zinc-300">Confirm your {formatUsd(amountCents)} tip.</p>
      <PaymentElement />
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full rounded-lg bg-amber-400 px-4 py-2 font-medium text-zinc-950 disabled:opacity-60"
      >
        {loading ? 'Confirming…' : 'Pay tip'}
      </button>
    </form>
  );
}
