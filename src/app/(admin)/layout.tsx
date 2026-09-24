import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin/moderation" className="font-semibold text-amber-400">
            DickRank staff
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <Link href="/admin/moderation" className="hover:text-white">
              Moderation
            </Link>
            <Link href="/" className="hover:text-white">
              Home
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
