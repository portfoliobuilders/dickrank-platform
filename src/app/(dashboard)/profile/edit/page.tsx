"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EditProfileSkeleton } from "@/components/ui/Skeleton";
import { DEFAULT_PREFERENCES, ORIENTATION_OPTIONS } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateProfileSchema } from "@/lib/validators";
import type { Orientation, OwnProfile, Preferences } from "@/types";

const fieldClass = "mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-rose-400";

export default function EditProfilePage() {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("undisclosed");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestDraft, setInterestDraft] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({ ...DEFAULT_PREFERENCES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/profile");
      const body = (await response.json().catch(() => ({}))) as OwnProfile & { error?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(body.error || "Could not load your profile");
        setLoading(false);
        return;
      }
      setProfile(body);
      setDisplayName(body.displayName ?? "");
      setBio(body.bio ?? "");
      setLocation(body.location ?? "");
      setOrientation(body.orientation ?? "undisclosed");
      setInterests(body.interests ?? []);
      setAvatarUrl(body.avatarUrl ?? "");
      setPreferences(body.preferences ?? { ...DEFAULT_PREFERENCES });
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function addInterest() {
    const next = interestDraft.trim();
    if (!next || interests.includes(next) || interests.length >= 20) return;
    setInterests((current) => [...current, next]);
    setInterestDraft("");
  }

  async function uploadAvatar(userId: string) {
    if (!avatarFile) return avatarUrl;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Avatar upload needs Supabase storage");
    const extension = avatarFile.type === "image/png" ? "png" : avatarFile.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, {
      upsert: true,
      contentType: avatarFile.type,
    });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextAvatar = await uploadAvatar(profile.id);
      const payload = {
        displayName,
        bio,
        location,
        orientation,
        interests,
        avatarUrl: nextAvatar || "",
        preferences,
      };
      const parsed = updateProfileSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the form and try again");
        return;
      }
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => ({}))) as OwnProfile & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not save your profile");
      setProfile(body);
      setAvatarUrl(body.avatarUrl ?? "");
      setAvatarFile(null);
      setPreferences(body.preferences);
      setMessage("Profile saved. Preferences are stored encrypted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <EditProfileSkeleton />;

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Edit profile</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {profile ? `@${profile.username}` : "Your public creator profile"}
        </p>
      </div>
      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Photo</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview || avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl">{(displayName || "?").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <label className="text-sm text-zinc-300">
            Avatar upload
            <input
              className="mt-1 block text-sm"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setError("Use an image under 5 MB");
                  return;
                }
                setAvatarFile(file);
                setAvatarPreview(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Public info</h2>
        <label className="block text-sm text-zinc-300">
          Display name
          <input className={fieldClass} value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
        <label className="block text-sm text-zinc-300">
          Bio
          <textarea className={fieldClass} rows={4} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} />
          <span className="mt-1 block text-xs text-zinc-500">{bio.length}/500</span>
        </label>
        <label className="block text-sm text-zinc-300">
          Location
          <input className={fieldClass} value={location} maxLength={120} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label className="block text-sm text-zinc-300">
          Orientation
          <select
            className={fieldClass}
            value={orientation}
            onChange={(event) => setOrientation(event.target.value as Orientation)}
          >
            {ORIENTATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <label className="block text-sm text-zinc-300" htmlFor="interest">
            Interests
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="interest"
              className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2"
              value={interestDraft}
              maxLength={40}
              onChange={(event) => setInterestDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addInterest();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addInterest}>
              Add
            </Button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {interests.map((interest) => (
              <li key={interest}>
                <button
                  type="button"
                  className="rounded-full bg-white/10 px-3 py-1 text-sm"
                  onClick={() => setInterests((current) => current.filter((item) => item !== interest))}
                >
                  {interest} ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        <div>
          <h2 className="text-lg font-medium">Preferences</h2>
          <p className="text-sm text-zinc-400">Encrypted before they are stored. Email stays inside that encrypted record.</p>
        </div>
        <PreferenceToggle
          label="Private account"
          checked={preferences.privateAccount}
          onChange={(privateAccount) => setPreferences((current) => ({ ...current, privateAccount }))}
        />
        <PreferenceToggle
          label="Show activity"
          checked={preferences.showActivity}
          onChange={(showActivity) => setPreferences((current) => ({ ...current, showActivity }))}
        />
        <PreferenceToggle
          label="Allow subscriptions"
          checked={preferences.allowSubscriptions}
          onChange={(allowSubscriptions) => setPreferences((current) => ({ ...current, allowSubscriptions }))}
        />
        <PreferenceToggle
          label="Email digest"
          checked={preferences.emailDigest}
          onChange={(emailDigest) => setPreferences((current) => ({ ...current, emailDigest }))}
        />
        <PreferenceToggle
          label="Show content warnings"
          checked={preferences.contentWarnings}
          onChange={(contentWarnings) => setPreferences((current) => ({ ...current, contentWarnings }))}
        />
        <label className="block text-sm text-zinc-300">
          Notification email
          <input
            className={fieldClass}
            type="email"
            autoComplete="email"
            value={preferences.notificationEmail}
            onChange={(event) => setPreferences((current) => ({ ...current, notificationEmail: event.target.value }))}
          />
        </label>
      </section>

      <Button type="submit" disabled={saving || !profile}>
        {saving ? "Saving" : "Save profile"}
      </Button>
    </form>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm text-zinc-200">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
