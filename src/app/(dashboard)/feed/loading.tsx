import { ContentGridSkeleton } from '@/components/ui/Skeleton';

export default function FeedLoading() {
  return (
    <div>
      <div className="mb-6 h-8 w-40 animate-pulse rounded bg-zinc-800" />
      <ContentGridSkeleton />
    </div>
  );
}
