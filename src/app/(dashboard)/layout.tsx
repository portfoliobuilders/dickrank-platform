import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <nav className="mb-8 flex items-center justify-between text-sm">
        <Link href="/" className="font-semibold tracking-wide text-amber-300">
          DickRank
        </Link>
        <Link href="/subscriptions" className="text-zinc-300 hover:text-white">
          Subscriptions
        </Link>
      </nav>
      {children}
    </div>
  );
}
