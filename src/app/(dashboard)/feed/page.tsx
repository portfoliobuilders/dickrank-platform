import { Suspense } from 'react';
import { FeedView } from '@/components/feed/FeedView';
import { ContentGridSkeleton } from '@/components/ui/Skeleton';
import { requirePageUser } from '@/lib/auth';
import type { FeedFilter } from '@/lib/types';

export const dynamic = 'force-dynamic';

function parseFilter(value: string | undefined): FeedFilter {
  if (value === 'following' || value === 'popular' || value === 'premium' || value === 'new') return value;
  return 'new';
}

export default async function FeedPage({ searchParams }: { searchParams: { filter?: string } }) {
  await requirePageUser('/feed');
  const initialFilter = parseFilter(searchParams.filter);

  return (
    <main>
      <h1 className="mb-2 text-2xl font-semibold">Your feed</h1>
      <p className="mb-6 text-sm text-zinc-400">Posts from people you follow, plus what is popular and new.</p>
      <Suspense fallback={<ContentGridSkeleton />}>
        <FeedView initialFilter={initialFilter} />
      </Suspense>
    </main>
  );
}
