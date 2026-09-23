import { notFound } from 'next/navigation';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { requirePageUser } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { usernameSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { username: string } }) {
  return { title: `@${params.username} · DickRank` };
}

export default async function CreatorProfilePage({ params }: { params: { username: string } }) {
  const parsed = usernameSchema.safeParse(decodeURIComponent(params.username));
  if (!parsed.success) notFound();
  const username = parsed.data;
  const user = await requirePageUser(`/creator/${username}`);
  if (user.ageVerification !== true) {
    return null;
  }
  const profile = await getStore().getCreator(username, user.id);
  if (!profile) notFound();

  return (
    <main>
      <ProfileHeader profile={profile} />
      <ProfileTabs profile={profile} />
    </main>
  );
}
