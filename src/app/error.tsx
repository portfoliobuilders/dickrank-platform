'use client';

import { useEffect } from 'react';
import { analytics } from '@/lib/analytics';
import { captureError } from '@/lib/error-tracking';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    analytics.trackError(error, 'app');
    void captureError(error, 'app');
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted-foreground">Refresh the page. If it keeps happening, try again in a minute.</p>
      <button className="mt-6 text-sm underline" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
