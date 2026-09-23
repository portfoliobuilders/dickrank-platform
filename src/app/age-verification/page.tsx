import { redirect } from 'next/navigation';
import { AgeGate } from '@/components/auth/AgeGate';
import { getBackendMode } from '@/lib/backend';
import { safeNextPath } from '@/lib/format';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AgeVerificationPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const nextPath = safeNextPath(searchParams.next);
  const user = await getSessionUser();
  if (user?.ageVerification === true) redirect(nextPath);
  return <AgeGate mode={getBackendMode()} nextPath={nextPath} />;
}
