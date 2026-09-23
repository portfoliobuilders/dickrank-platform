import { requirePageUser } from '@/lib/auth';

export default async function UploadPage() {
  const account = await requirePageUser();
  if (!account) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-semibold">Upload</h1>
        <p className="mt-3 text-muted-foreground">The database is not reachable yet.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Upload</h1>
      <p className="mt-3 text-muted-foreground">
        This area is limited to age-verified members. {account.username} can upload from here once media tools are
        connected.
      </p>
    </main>
  );
}
