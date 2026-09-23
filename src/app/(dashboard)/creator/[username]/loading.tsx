import { ContentCardSkeleton, ProfileHeaderSkeleton } from "@/components/ui/Skeleton";

export default function CreatorLoading() {
  return (
    <div className="space-y-8">
      <ProfileHeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <ContentCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
