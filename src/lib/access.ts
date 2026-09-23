import type { Content } from '@prisma/client';
import type { AccountWithProfile } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';

export async function canViewContent(
  viewer: AccountWithProfile,
  content: Pick<Content, 'creatorId' | 'visibility' | 'scanStatus'>,
): Promise<boolean> {
  if (viewer.ageVerification !== true) return false;
  if (content.creatorId === viewer.id) return true;
  if (content.scanStatus !== 'CLEAN') return false;
  if (content.visibility === 'PUBLIC') return true;
  if (content.visibility === 'PRIVATE') return false;

  const subscription = await getPrisma().subscription.findUnique({
    where: {
      subscriberId_creatorId: {
        subscriberId: viewer.id,
        creatorId: content.creatorId,
      },
    },
  });
  return subscription?.status === 'ACTIVE';
}
