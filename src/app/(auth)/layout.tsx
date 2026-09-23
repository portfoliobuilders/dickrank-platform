import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-10">
        <header className="mb-8 text-center">
          <Link href="/" className="text-sm font-semibold tracking-wide text-white">
            DickRank
          </Link>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-rose-400">18+ only</p>
        </header>
        {children}
      </div>
    </div>
  );
}
