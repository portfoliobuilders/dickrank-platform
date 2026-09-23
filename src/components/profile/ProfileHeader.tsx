"use client";

import { useState } from "react";
import { SubscribeButton } from "@/components/profile/SubscribeButton";
import type { PublicProfile } from "@/types";

export function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const [followerCount, setFollowerCount] = useState(profile.followerCount);
  const name = profile.displayName || profile.username;

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-2xl font-semibold">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{name}</h1>
          <span className="text-zinc-400">@{profile.username}</span>
          {profile.isVerified ? (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-200">Verified</span>
          ) : null}
        </div>
        {profile.bio ? <p className="max-w-2xl text-zinc-300">{profile.bio}</p> : null}
        <p className="text-sm text-zinc-400">
          <span className="font-medium text-white">{profile.contentCount}</span> posts
          <span className="mx-2">·</span>
          <span className="font-medium text-white">{followerCount}</span> followers
        </p>
        {profile.isOwner ? (
          <p className="text-sm text-zinc-400">This is your profile.</p>
        ) : profile.isCreator && profile.acceptsSubscriptions ? (
          <SubscribeButton
            username={profile.username}
            initialSubscribed={profile.viewerSubscribed}
            onDelta={(delta) => setFollowerCount((count) => Math.max(0, count + delta))}
            onCount={setFollowerCount}
          />
        ) : null}
      </div>
    </header>
  );
}
