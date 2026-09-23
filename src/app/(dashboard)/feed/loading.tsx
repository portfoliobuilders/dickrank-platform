import { ContentGridSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function FeedLoading() {
  return (
    <div>
      <Skeleton className="mb-4 h-8 w-40" />
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <ContentGridSkeleton />
    </div>
  );
}
