import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { requirePageUser } from '@/lib/auth';
import { getStore } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit profile · DickRank' };

export default async function EditProfilePage() {
  const user = await requirePageUser('/profile/edit');
  const profile = await getStore().getEditableProfile(user.id);
  if (!profile) {
    return <p>Your profile could not be loaded.</p>;
  }

  return (
    <main className="mx-auto max-w-xl">
      <h1 className="mb-2 text-2xl font-semibold">Edit profile</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Update how you appear on DickRank. Preference fields are encrypted at rest.
      </p>
      <EditProfileForm profile={profile} />
    </main>
  );
}
