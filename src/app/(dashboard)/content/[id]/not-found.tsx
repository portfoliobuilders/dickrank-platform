import Link from 'next/link';

export default function ContentNotFound() {
  return (
    <div className="rounded-2xl border border-zinc-800 p-6">
      <h1 className="text-xl font-semibold">Content unavailable</h1>
      <p className="mt-2 text-sm text-zinc-400">This post was removed or the link is wrong.</p>
      <Link href="/feed" className="mt-4 inline-block text-sm text-rose-300">
        Back to feed
      </Link>
    </div>
  );
}
