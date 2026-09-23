export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-zinc-800/80 ${className}`} />;
}

export function ContentCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <Skeleton className="aspect-[4/5] rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ContentGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <ContentCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <ContentGridSkeleton count={4} />
    </div>
  );
}

export function ContentPageSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="space-y-4">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
      <ContentGridSkeleton count={4} />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-24 rounded-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
