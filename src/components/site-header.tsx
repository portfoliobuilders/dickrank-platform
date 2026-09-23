import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SignOutButton } from '@/components/sign-out-button';

export async function SiteHeader() {
  let signedIn = false;
  try {
    const session = await getServerSession(authOptions);
    signedIn = Boolean(session?.user?.id);
  } catch {
    signedIn = false;
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          DickRank
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/explore">Explore</Link>
          {signedIn ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
