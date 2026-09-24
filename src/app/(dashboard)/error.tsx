'use client';

import { useEffect } from 'react';
import { analytics } from '@/lib/analytics';
import { captureError } from '@/lib/error-tracking';

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    analytics.trackError(error, 'dashboard');
    void captureError(error, 'dashboard');
  }, [error]);

  return (
    <div className="rounded-2xl border border-zinc-800 p-6">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-400">Refresh this page or try again.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-full bg-zinc-800 px-4 py-2 text-sm">
        Try again
      </button>
    </div>
  );
}
