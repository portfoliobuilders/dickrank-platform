import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/feed" className="text-lg font-semibold">
            DickRank
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-300">
            <Link href="/feed" className="hover:text-white">
              Feed
            </Link>
            <Link href="/profile/edit" className="hover:text-white">
              Edit profile
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
