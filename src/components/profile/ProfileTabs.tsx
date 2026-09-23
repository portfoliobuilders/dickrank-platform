"use client";

import { useState } from "react";
import { ContentCard } from "@/components/content/ContentCard";
import { ORIENTATION_OPTIONS } from "@/lib/constants";
import type { ContentCardModel, PublicProfile, ScheduleItem } from "@/types";

const tabs = [
  { id: "content", label: "Content" },
  { id: "about", label: "About" },
  { id: "schedule", label: "Schedule" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function ProfileTabs({
  profile,
  content,
  schedule,
}: {
  profile: PublicProfile;
  content: ContentCardModel[];
  schedule: ScheduleItem[];
}) {
  const [tab, setTab] = useState<TabId>("content");
  const orientation = ORIENTATION_OPTIONS.find((option) => option.value === profile.orientation)?.label;

  return (
    <section className="mt-8">
      <div role="tablist" aria-label="Profile sections" className="flex gap-2 border-b border-white/10">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === item.id ? "border-rose-400 text-white" : "border-transparent text-zinc-400"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="py-6">
        {tab === "content" ? (
          content.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {content.map((item) => (
                <ContentCard key={item.id} content={item} />
              ))}
            </div>
          ) : (
            <p className="text-zinc-400">No posts yet.</p>
          )
        ) : null}
        {tab === "about" ? (
          <div className="max-w-2xl space-y-4 text-sm text-zinc-300">
            {profile.isPrivate ? <p>This creator keeps some details private.</p> : null}
            <p>
              <span className="text-zinc-500">Location · </span>
              {profile.location || "Not shared"}
            </p>
            <p>
              <span className="text-zinc-500">Orientation · </span>
              {orientation || "Not shared"}
            </p>
            <div>
              <p className="text-zinc-500">Interests</p>
              {profile.interests.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {profile.interests.map((interest) => (
                    <li key={interest} className="rounded-full bg-white/10 px-3 py-1">
                      {interest}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2">Not shared</p>
              )}
            </div>
          </div>
        ) : null}
        {tab === "schedule" ? (
          schedule.length > 0 ? (
            <ul className="space-y-3">
              {schedule.map((item) => (
                <li key={item.id} className="rounded-2xl border border-white/10 bg-zinc-900 p-4">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-zinc-400">
                    {new Date(item.startsAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {item.description ? <p className="mt-2 text-sm text-zinc-300">{item.description}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-400">No upcoming events.</p>
          )
        ) : null}
      </div>
    </section>
  );
}
