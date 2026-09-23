'use client';

import { useState } from 'react';
import { ORIENTATIONS, type UpdateProfileInput } from '@/lib/validators';
import type { EditableProfile, ProfilePreferences } from '@/lib/types';

const ORIENTATION_LABELS: Record<(typeof ORIENTATIONS)[number], string> = {
  straight: 'Straight',
  gay: 'Gay',
  lesbian: 'Lesbian',
  bisexual: 'Bisexual',
  pansexual: 'Pansexual',
  asexual: 'Asexual',
  queer: 'Queer',
  prefer_not_to_say: 'Prefer not to say',
};

export function EditProfileForm({ profile }: { profile: EditableProfile }) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [orientation, setOrientation] = useState(profile.orientation ?? '');
  const [interests, setInterests] = useState(profile.interests);
  const [draftInterest, setDraftInterest] = useState('');
  const [preferences, setPreferences] = useState<ProfilePreferences>(profile.preferences);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  function addInterest() {
    const next = draftInterest.trim();
    if (!next || interests.includes(next) || interests.length >= 12) return;
    setInterests((current) => [...current, next]);
    setDraftInterest('');
  }

  async function uploadAvatar(file: File) {
    setError('');
    const body = new FormData();
    body.set('file', file);
    const response = await fetch('/api/profile/avatar', { method: 'POST', body });
    const payload = (await response.json()) as { avatarUrl?: string; error?: string };
    if (!response.ok || !payload.avatarUrl) {
      throw new Error(payload.error || 'Could not upload avatar');
    }
    setAvatarUrl(payload.avatarUrl);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    const payload: UpdateProfileInput = {
      displayName,
      bio,
      location,
      orientation: orientation ? (orientation as UpdateProfileInput['orientation']) : null,
      interests,
      preferences,
    };
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (response.status === 401 || response.status === 403) {
        window.location.href = '/verify-age?next=/profile/edit';
        return;
      }
      if (!response.ok) throw new Error(body.error || 'Could not save profile');
      setMessage('Profile saved. Preferences were encrypted before they were stored.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save profile');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-8">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <div className="h-24 w-24 rounded-full bg-zinc-800" />
        )}
        <label className="text-sm text-zinc-300">
          Avatar
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1 block text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void uploadAvatar(file).catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : 'Could not upload avatar');
              });
            }}
          />
        </label>
      </div>

      <label className="block text-sm text-zinc-300">
        Display name
        <input
          required
          maxLength={60}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Bio
        <textarea
          maxLength={500}
          rows={4}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Location
        <input
          maxLength={80}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Orientation
        <select
          value={orientation}
          onChange={(event) => setOrientation(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
        >
          <option value="">Not shared</option>
          {ORIENTATIONS.map((value) => (
            <option key={value} value={value}>
              {ORIENTATION_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm text-zinc-300">Interests</legend>
        <div className="flex gap-2">
          <input
            value={draftInterest}
            maxLength={32}
            onChange={(event) => setDraftInterest(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addInterest();
              }
            }}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="Add an interest"
          />
          <button type="button" onClick={addInterest} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">
            Add
          </button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {interests.map((interest) => (
            <li key={interest}>
              <button
                type="button"
                onClick={() => setInterests((current) => current.filter((item) => item !== interest))}
                className="rounded-full bg-zinc-800 px-3 py-1 text-sm"
              >
                {interest} ×
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <legend className="px-1 text-sm font-medium text-zinc-200">Preferences</legend>
        <p className="text-sm text-zinc-400">
          These settings, including notification email, are encrypted before they are saved.
        </p>
        <label className="block text-sm text-zinc-300">
          Notification email
          <input
            type="email"
            value={preferences.notificationEmail}
            onChange={(event) =>
              setPreferences((current) => ({ ...current, notificationEmail: event.target.value }))
            }
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="Optional"
          />
        </label>
        {(
          [
            ['showOnlineStatus', 'Show when I am online'],
            ['allowMessages', 'Allow messages from other members'],
            ['hideFromSearch', 'Hide my profile from search'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
