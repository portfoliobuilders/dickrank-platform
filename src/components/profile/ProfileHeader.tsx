'use client';

import { useState } from 'react';
import type { PublicProfile } from '@/lib/types';
import { SubscribeButton } from '@/components/profile/SubscribeButton';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';

type VerificationKey = 'id' | 'photo';

const VERIFICATION_LABELS: Record<VerificationKey, string> = {
  id: 'ID Verified',
  photo: 'Photo Verified',
};

function verificationChecks(profile: PublicProfile): VerificationKey[] {
  const checks: VerificationKey[] = [];
  if (profile.ageVerification) checks.push('id');
  if (profile.isVerified) checks.push('photo');
  return checks;
}

function verificationTier(count: number) {
  if (count >= 2) return { tier: 'silver' as const, label: 'Highly Verified' };
  if (count >= 1) return { tier: 'bronze' as const, label: 'Verified' };
  return { tier: 'none' as const, label: 'Unverified' };
}

function profileStats(profile: PublicProfile) {
  const rated = profile.content.filter((item) => item.rating > 0);
  const averageRating =
    rated.length === 0 ? null : rated.reduce((sum, item) => sum + item.rating, 0) / rated.length;
  const viewCount = profile.content.reduce((sum, item) => sum + item.viewCount, 0);
  return { averageRating, reviewCount: rated.length, viewCount };
}

function IconVerified({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 2.2 14.5 4l3.1-.4.9 3 2.7 1.6-1 3 1 3-2.7 1.6-.9 3-3.1-.4L12 21.8 9.5 20l-3.1.4-.9-3L2.8 15.8l1-3-1-3 2.7-1.6.9-3 3.1.4L12 2.2Zm-1.1 12.3 5-5-1.3-1.3-3.7 3.7-1.7-1.7-1.3 1.3 3 3Z" />
    </svg>
  );
}

export function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const [followers, setFollowers] = useState(profile.followerCount);
  const [shareNote, setShareNote] = useState('');
  const [reportNote, setReportNote] = useState('');
  const name = profile.displayName || profile.username;
  const checks = verificationChecks(profile);
  const tier = verificationTier(checks.length);
  const stats = profileStats(profile);
  const initial = name.slice(0, 1).toUpperCase();

  async function shareProfile() {
    const url = `${window.location.origin}/creator/${profile.username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote('Profile link copied.');
    } catch {
      setShareNote('Could not share this profile.');
    }
  }

  return (
    <header className="-mx-6 -mt-8 bg-zinc-950 text-white">
      <div className="relative h-48 overflow-hidden md:h-64">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-full w-full scale-110 object-cover blur-2xl" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-amber-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-zinc-950/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="-mt-16 flex flex-col gap-6 md:-mt-20 md:flex-row">
          <div className="relative h-32 w-32 shrink-0 md:h-40 md:w-40">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-full w-full rounded-2xl border-4 border-zinc-950 object-cover shadow-2xl"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-2xl border-4 border-zinc-950 bg-zinc-800 text-4xl font-semibold shadow-2xl">
                {initial}
              </div>
            )}
            {tier.tier !== 'none' ? (
              <div
                className={cn(
                  'absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-zinc-950',
                  tier.tier === 'silver' && 'bg-slate-300 text-zinc-950',
                  tier.tier === 'bronze' && 'bg-amber-600 text-zinc-950',
                )}
              >
                <IconVerified className="h-5 w-5" />
                <span className="sr-only">{tier.label}</span>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 pb-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold md:text-4xl">{name}</h1>
                  {tier.tier !== 'none' ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-bold',
                        tier.tier === 'silver' && 'border-slate-400/50 bg-slate-400/20 text-slate-200',
                        tier.tier === 'bronze' && 'border-amber-700/50 bg-amber-700/20 text-amber-500',
                      )}
                    >
                      <IconVerified className="h-4 w-4" />
                      {tier.label}
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-500">Unverified</span>
                  )}
                </div>
                <p className="mt-1 text-lg text-zinc-400">@{profile.username}</p>
                {profile.location ? (
                  <p className="mt-3 flex items-center gap-1.5 text-zinc-400">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {profile.location}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {profile.isCreator && !profile.isSelf ? (
                  <SubscribeButton
                    username={profile.username}
                    initialSubscribed={profile.subscribed}
                    initialFollowerCount={profile.followerCount}
                    onFollowerCount={setFollowers}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => void shareProfile()}
                  className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                  aria-label="Share profile"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => setReportNote('Open a post and use Report if something on this profile breaks the rules.')}
                  className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                  aria-label="Report profile"
                >
                  Report
                </button>
              </div>
            </div>

            {shareNote ? <p className="mt-2 text-sm text-zinc-400">{shareNote}</p> : null}
            {reportNote ? <p className="mt-2 text-sm text-zinc-400">{reportNote}</p> : null}

            {profile.bio ? <p className="mt-4 max-w-2xl leading-relaxed text-zinc-300">{profile.bio}</p> : null}

            <div className="mt-6 flex gap-8 border-y border-zinc-800 py-4">
              <div>
                <div className="text-2xl font-bold">{formatCount(profile.contentCount)}</div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">Posts</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCount(followers)}</div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">Followers</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-400">
                  {stats.averageRating === null ? '—' : stats.averageRating.toFixed(1)}
                </div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">
                  {stats.reviewCount} rated posts
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCount(stats.viewCount)}</div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">Views</div>
              </div>
            </div>

            {checks.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {checks.map((key) => (
                  <li
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    <IconVerified className="h-3 w-3 text-amber-400" />
                    {VERIFICATION_LABELS[key]}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
