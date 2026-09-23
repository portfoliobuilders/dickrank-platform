'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
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
