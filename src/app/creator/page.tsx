import { requirePageUser } from '@/lib/auth';

export default async function CreatorPage() {
  const account = await requirePageUser();
  if (!account) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-semibold">Creator</h1>
        <p className="mt-3 text-muted-foreground">The database is not reachable yet.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Creator tools</h1>
      <p className="mt-3 text-muted-foreground">
        {account.username}, this creator area is locked to accounts that passed age review.
      </p>
    </main>
  );
}
