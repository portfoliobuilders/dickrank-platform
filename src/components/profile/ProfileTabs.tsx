'use client';

import { useState } from 'react';
import { ContentGrid } from '@/components/content/ContentCard';
import { orientationLabel } from '@/lib/format';
import type { PublicProfile } from '@/lib/types';

const TABS = ['Content', 'About', 'Schedule'] as const;

export function ProfileTabs({ profile }: { profile: PublicProfile }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Content');

  return (
    <section className="mt-8">
      <div role="tablist" aria-label="Profile sections" className="mb-6 flex gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-2 text-sm ${
              tab === item ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === 'Content' ? <ContentGrid items={profile.content} /> : null}
      {tab === 'About' ? (
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p>{profile.bio || 'No bio yet.'}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-400">Location</dt>
              <dd>{profile.location || 'Not shared'}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Orientation</dt>
              <dd className="capitalize">{orientationLabel(profile.orientation)}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Interests</p>
            {profile.interests.length === 0 ? (
              <p className="text-sm">No interests listed.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <li key={interest} className="rounded-full bg-zinc-800 px-3 py-1 text-sm">
                    {interest}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
      {tab === 'Schedule' ? (
        profile.schedule.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-zinc-400">
            No upcoming events.
          </p>
        ) : (
          <ul className="space-y-3">
            {profile.schedule.map((event) => (
              <li key={event.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-zinc-400">
                  {new Date(event.startsAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
