import { ContentGridSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function ContentLoading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="space-y-4">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
      <ContentGridSkeleton count={4} />
    </div>
  );
}
