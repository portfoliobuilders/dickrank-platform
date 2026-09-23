import Link from "next/link";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/feed" className="text-lg font-semibold tracking-tight">
            DickRank
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-300">
            <Link href="/feed">Feed</Link>
            <Link href="/profile/edit">Edit profile</Link>
          </nav>
        </div>
      </header>
      {isDemoMode() ? (
        <p className="bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
          Preview mode uses sample data in this session. Connect Supabase to save real profiles and posts.
        </p>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
