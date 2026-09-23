import { redirect } from 'next/navigation';
import { AgeGate } from '@/components/auth/AgeGate';
import { getSessionUser } from '@/lib/auth';
import { getBackendMode } from '@/lib/backend';
import { safeNextPath } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function VerifyAgePage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const nextPath = safeNextPath(searchParams.next);
  const user = await getSessionUser();
  if (user?.ageVerification === true) redirect(nextPath);
  return <AgeGate mode={getBackendMode()} nextPath={nextPath} />;
}
