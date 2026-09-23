import { requirePageUser } from '@/lib/auth';

export default async function DashboardPage() {
  const account = await requirePageUser();
  if (!account) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-3 text-muted-foreground">The database is not reachable yet. Check DATABASE_URL and try again.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="mt-3 text-muted-foreground">
        Signed in as {account.profile?.displayName ?? account.username}. Age verification is on, so member tools are
        open.
      </p>
    </main>
  );
}
