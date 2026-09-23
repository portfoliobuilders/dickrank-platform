'use client';

import { useState } from 'react';
import type { BackendMode } from '@/lib/backend';

export function AgeGate({ mode, nextPath }: { mode: BackendMode; nextPath: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed) {
      setError('Confirm that you are 18 or older to continue.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/account/age-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true, next: nextPath }),
      });
      const body = (await response.json()) as { next?: string; error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not verify age');
      window.location.href = body.next || nextPath;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify age');
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-wide text-rose-300">DickRank</p>
      <h1 className="mt-2 text-3xl font-semibold">Adults only</h1>
      <p className="mt-3 text-zinc-300">
        This platform is for people 18 and older. Confirm your age before viewing profiles or content.
      </p>
      {mode === 'unconfigured' ? (
        <p className="mt-6 rounded-xl border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-100">
          The app is not connected to a database yet. Set DATA_BACKEND=memory for a local preview, or add the
          Supabase keys from .env.example.
        </p>
      ) : null}
      {mode === 'supabase' ? (
        <p className="mt-6 text-sm text-zinc-400">
          Sign in with your member account before confirming your age. Age verification is stored on your profile.
        </p>
      ) : null}
      {mode !== 'unconfigured' ? (
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>I confirm I am 18 or older and I want to view adult content.</span>
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? 'Checking…' : 'Continue'}
          </button>
        </form>
      ) : null}
    </main>
  );
}
