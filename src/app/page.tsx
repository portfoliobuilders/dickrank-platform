import Link from "next/link";

export default function HomePage({
  searchParams,
}: {
  searchParams?: { notice?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-sm uppercase tracking-wide text-amber-300">Adults 18+ only</p>
      <h1 className="text-4xl font-semibold">Creator payments</h1>
      <p className="text-zinc-400">
        Subscriptions and tips are processed by Stripe. Age verification is required before anyone can pay or get paid.
      </p>
      {searchParams?.notice === "age" ? (
        <p className="text-red-300">Staff tools that show content require a verified 18+ admin account.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Link className="text-amber-300 underline" href="/creator/dashboard">
          Creator dashboard
        </Link>
        <Link className="text-amber-300 underline" href="/dmca">
          DMCA / copyright policy
        </Link>
        <Link className="text-amber-300 underline" href="/account">
          Download or delete your data
        </Link>
      </div>
    </main>
  );
}
