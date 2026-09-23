import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">Adults 18+ only</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">DickRank</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">
        Create an account, confirm your email, and verify your age before you can open creator tools or uploads.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/register" className="rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400">
          Create account
        </Link>
        <Link href="/login" className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-900">
          Sign in
        </Link>
        <Link href="/explore" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white">
          Explore
        </Link>
      </div>
    </main>
  );
}
