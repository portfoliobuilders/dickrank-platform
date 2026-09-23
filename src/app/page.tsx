import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm text-primary">18+ only</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">DickRank</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Rankings for adult creators. Create an account, confirm your email, then send a government ID. A reviewer
        unlocks the members area only after that check.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/register">Create an account</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/explore">Explore</Link>
        </Button>
      </div>
    </main>
  );
}
