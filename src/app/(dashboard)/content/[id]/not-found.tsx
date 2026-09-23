import Link from 'next/link';

export default function ContentNotFound() {
  return (
    <main>
      <h1 className="text-2xl font-semibold">This post is gone</h1>
      <p className="mt-2 text-zinc-400">It may have been deleted or never published.</p>
      <Link href="/feed" className="mt-6 inline-block text-rose-300 hover:underline">
        Back to the feed
      </Link>
    </main>
  );
}
