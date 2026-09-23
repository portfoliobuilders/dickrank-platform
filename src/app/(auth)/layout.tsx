import { Suspense } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-sm font-semibold tracking-tight">
        DickRank
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>{children}</Suspense>
    </div>
  );
}
