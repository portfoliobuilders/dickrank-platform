import { FormSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function EditProfileLoading() {
  return (
    <div className="mx-auto max-w-xl">
      <Skeleton className="mb-6 h-8 w-40" />
      <FormSkeleton />
    </div>
  );
}
