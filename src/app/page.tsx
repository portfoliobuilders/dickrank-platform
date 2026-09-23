import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-sm uppercase tracking-wide text-amber-300">Adults 18+ only</p>
      <h1 className="text-4xl font-semibold">Creator payments</h1>
      <p className="text-zinc-400">
        Subscriptions and tips are processed by Stripe. Age verification is required before anyone can pay or get paid.
      </p>
      <Link className="text-amber-300 underline" href="/creator/dashboard">
        Creator dashboard
      </Link>
    </main>
  );
}
