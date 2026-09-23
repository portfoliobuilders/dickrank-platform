import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold">
            DickRank
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-300">
            <Link href="/discovery">Discover</Link>
            <Link href="/creator/dashboard">Dashboard</Link>
            <Link href="/creator/onboarding">Payout setup</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
