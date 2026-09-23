import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">DickRank</p>
      <h1 className="mt-3 text-4xl font-semibold">Premium posts stay locked until you subscribe or buy them.</h1>
      <p className="mt-4 max-w-xl text-zinc-300">
        Members who are 18 or older can manage the creators they support and keep access through a cancelled period or a 3-day grace period after a failed payment.
      </p>
      <Link
        href="/subscriptions"
        className="mt-8 inline-flex w-fit rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950"
      >
        View subscriptions
      </Link>
    </main>
  );
}
