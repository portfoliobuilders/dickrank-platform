import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { requirePageUser } from '@/lib/auth';
import { getStore } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit profile · DickRank' };

export default async function EditProfilePage() {
  const user = await requirePageUser('/profile/edit');
  if (user.ageVerification !== true) return null;
  const profile = await getStore().getEditableProfile(user.id);
  if (!profile) {
    return <p>Your profile could not be loaded.</p>;
  }

  return (
    <main className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">Edit profile</h1>
      <EditProfileForm profile={profile} />
    </main>
  );
}
