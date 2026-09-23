"use client";

import { useEffect, useState } from "react";

import { LeaderboardCard } from "@/components/leaderboard/LeaderboardCard";
import { CONTENT_TYPES, PERIOD_OPTIONS, RATING_CATEGORY_OPTIONS } from "@/lib/constants";
import type { Trend } from "@/lib/ranking-algorithm";

type Tab = "overall" | "category" | "type" | "rising";

type Row = {
  rank: number;
  score: number;
  trend: Trend;
  user: { id: string; username: string; avatarUrl: string | null };
  stats: { averageRating: number; ratingCount: number };
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overall", label: "Overall" },
  { id: "category", label: "By Category" },
  { id: "type", label: "By Type" },
  { id: "rising", label: "Rising Stars" },
];

export default function RankingsPage() {
  const [tab, setTab] = useState<Tab>("overall");
  const [dimension, setDimension] = useState<(typeof RATING_CATEGORY_OPTIONS)[number]["id"]>("feel");
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]["id"]>("video");
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["id"]>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const category =
    tab === "overall" ? "overall" : tab === "rising" ? "rising" : tab === "category" ? dimension : contentType;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRows([]);

    const params = new URLSearchParams({ category, period, limit: "10" });
    fetch(`/api/leaderboard?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string; rankings?: Row[] };
        if (!response.ok) throw new Error(payload.error ?? "Rankings could not be loaded.");
        setRows(payload.rankings ?? []);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setRows([]);
        setError(fetchError instanceof Error ? fetchError.message : "Rankings could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [category, period]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-wide text-amber-300">18+ members</p>
      <h1 className="mt-2 text-3xl font-semibold">Rankings</h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        Creators are scored from review averages, verified partners, activity, health verification, content quality,
        and community participation. This list shows the top 10.
      </p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Ranking boards">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm ${
              tab === item.id ? "bg-white text-zinc-950" : "bg-zinc-900 text-zinc-200 ring-1 ring-zinc-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "category" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {RATING_CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={dimension === option.id}
              onClick={() => setDimension(option.id)}
              className={`rounded-full px-3 py-1 text-sm ${
                dimension === option.id ? "bg-amber-400 text-zinc-950" : "bg-zinc-900 text-zinc-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "type" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {CONTENT_TYPES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={contentType === option.id}
              onClick={() => setContentType(option.id)}
              className={`rounded-full px-3 py-1 text-sm ${
                contentType === option.id ? "bg-amber-400 text-zinc-950" : "bg-zinc-900 text-zinc-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Time period">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={period === option.id}
            onClick={() => setPeriod(option.id)}
            className={`rounded-full px-3 py-1 text-sm ${
              period === option.id ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 ring-1 ring-zinc-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="mt-6" aria-live="polite">
        {loading ? <p className="text-zinc-400">Loading rankings…</p> : null}
        {error ? <p className="text-rose-300">{error}</p> : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="text-zinc-400">No creators in this ranking yet.</p>
        ) : null}
        <ol className="space-y-3">
          {rows.map((row) => (
            <li key={row.user.id}>
              <LeaderboardCard
                rank={row.rank}
                username={row.user.username}
                avatarUrl={row.user.avatarUrl}
                score={row.score}
                trend={row.trend}
                scoreLabel={tab === "rising" ? "Gain" : "Score"}
                profileHref={`/profile/${encodeURIComponent(row.user.username)}`}
              />
              <p className="px-2 pt-1 text-xs text-zinc-500">
                Average rating {row.stats.averageRating.toFixed(1)} · {row.stats.ratingCount} reviews
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
