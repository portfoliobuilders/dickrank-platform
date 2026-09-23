import Link from 'next/link';
import { SubscribeButton } from '@/components/profile/SubscribeButton';
import { formatCount } from '@/lib/format';
import type { PublicProfile } from '@/lib/types';

export function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const name = profile.displayName || profile.username;

  return (
    <header className="flex flex-col gap-6 border-b border-zinc-800 pb-8 sm:flex-row sm:items-start">
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 text-2xl">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold">{name}</h1>
          {profile.isVerified ? (
            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-300">
              Verified
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-400">@{profile.username}</p>
        {profile.bio ? <p className="mt-3 max-w-2xl text-zinc-200">{profile.bio}</p> : null}
        <dl className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <dt className="text-zinc-500">Posts</dt>
            <dd className="font-medium">{formatCount(profile.contentCount)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Followers</dt>
            <dd className="font-medium">{formatCount(profile.followerCount)}</dd>
          </div>
        </dl>
      </div>
      <div className="shrink-0">
        {profile.isSelf ? (
          <Link href="/profile/edit" className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-950">
            Edit profile
          </Link>
        ) : profile.isCreator ? (
          <SubscribeButton
            username={profile.username}
            initialSubscribed={profile.subscribed}
            initialFollowerCount={profile.followerCount}
          />
        ) : null}
      </div>
    </header>
  );
}
