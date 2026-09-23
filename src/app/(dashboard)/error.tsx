'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="space-y-3">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-zinc-400">{error.message || 'Please try again.'}</p>
      <button type="button" onClick={reset} className="rounded-full bg-zinc-800 px-4 py-2 text-sm">
        Try again
      </button>
    </main>
  );
}
