import { ContentGridSkeleton, ProfileHeaderSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function CreatorLoading() {
  return (
    <div>
      <ProfileHeaderSkeleton />
      <div className="mt-8 flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="mt-6">
        <ContentGridSkeleton />
      </div>
    </div>
  );
}
