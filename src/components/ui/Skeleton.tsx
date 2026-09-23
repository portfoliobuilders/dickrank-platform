export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-800 ${className}`} />;
}

export function ContentCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ContentGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <ContentCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
      <Skeleton className="h-28 w-28 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <div className="flex gap-6">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-24 rounded-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}
