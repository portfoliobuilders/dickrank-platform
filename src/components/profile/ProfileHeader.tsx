'use client';

import { useState } from 'react';
import { formatCount } from '@/lib/format';
import type { PublicProfile } from '@/lib/types';
import { SubscribeButton } from '@/components/profile/SubscribeButton';

export function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const [followers, setFollowers] = useState(profile.followerCount);
  const name = profile.displayName || profile.username;

  return (
    <header className="flex flex-col gap-6 border-b border-zinc-800 pb-8 sm:flex-row sm:items-end">
      {profile.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt=""
          className="h-28 w-28 rounded-full border border-zinc-700 object-cover"
        />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-zinc-800 text-3xl font-semibold">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold">{name}</h1>
          {profile.isVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-sm text-sky-300">
              <span aria-hidden="true">✓</span> Verified
            </span>
          ) : null}
        </div>
        <p className="text-zinc-400">@{profile.username}</p>
        {profile.bio ? <p className="max-w-2xl text-zinc-200">{profile.bio}</p> : null}
        <div className="flex gap-8 text-sm">
          <div>
            <div className="text-lg font-semibold">{formatCount(profile.contentCount)}</div>
            <div className="text-zinc-400">Posts</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{formatCount(followers)}</div>
            <div className="text-zinc-400">Followers</div>
          </div>
        </div>
      </div>
      {profile.isCreator && !profile.isSelf ? (
        <SubscribeButton
          username={profile.username}
          initialSubscribed={profile.subscribed}
          initialFollowerCount={profile.followerCount}
          onFollowerCount={setFollowers}
        />
      ) : null}
    </header>
  );
}
