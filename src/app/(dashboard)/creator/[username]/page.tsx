import { notFound, redirect } from 'next/navigation';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { getSessionUser, requirePageUser } from '@/lib/auth';
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
  const session = await getSessionUser();
  if (!session || session.ageVerification !== true) {
    redirect(`/verify-age?next=${encodeURIComponent(`/creator/${username}`)}`);
  }
  await requirePageUser(`/creator/${username}`);
  const profile = await getStore().getCreator(username, session.id);
  if (!profile) notFound();

  return (
    <main>
      <ProfileHeader profile={profile} />
      <ProfileTabs profile={profile} />
    </main>
  );
}
