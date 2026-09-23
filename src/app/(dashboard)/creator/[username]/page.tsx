import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { listContent } from "@/lib/content";
import { getPublicProfile, listSchedule } from "@/lib/profiles";
import { getViewer } from "@/lib/session";
import { usernameSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  return { title: `@${params.username} · DickRank` };
}

export default async function CreatorProfilePage({ params }: { params: { username: string } }) {
  const username = usernameSchema.safeParse(params.username);
  if (!username.success) notFound();

  const viewer = await getViewer();
  if (!viewer.profile?.ageVerified) redirect("/verify-age");

  const profile = await getPublicProfile(viewer.supabase, username.data, viewer.profile.id);
  if (!profile) notFound();

  const [content, schedule] = await Promise.all([
    listContent(viewer.supabase, viewer.profile, {
      creator: profile.username,
      page: 1,
      sort: "newest",
    }),
    listSchedule(viewer.supabase, profile.username),
  ]);

  return (
    <div>
      <ProfileHeader profile={profile} />
      <ProfileTabs profile={profile} content={content.items} schedule={schedule} />
    </div>
  );
}
