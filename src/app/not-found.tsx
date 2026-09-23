import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-zinc-400">That profile or post is not available.</p>
      <Link href="/feed" className="mt-6 text-rose-300">
        Back to the feed
      </Link>
    </main>
  );
}
