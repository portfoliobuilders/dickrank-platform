import type { Trend } from "@/lib/ranking-algorithm";

export type LeaderboardCardProps = {
  rank: number;
  username: string;
  avatarUrl: string | null;
  score: number;
  trend: Trend;
  profileHref: string;
  scoreLabel?: string;
};

const PODIUM: Record<number, string> = {
  1: "border-amber-400/80 bg-amber-400/10 text-amber-200",
  2: "border-zinc-300/80 bg-zinc-300/10 text-zinc-100",
  3: "border-orange-700/80 bg-orange-700/15 text-orange-200",
};

function rankLabel(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "same") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-zinc-400" aria-label="Rank unchanged">
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Steady
      </span>
    );
  }

  const up = trend === "up";
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm ${up ? "text-emerald-300" : "text-rose-300"}`}
      aria-label={up ? "Rank up" : "Rank down"}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <path
          d={up ? "M10 4l5 6H5l5-6zm0 6v6" : "M10 16l-5-6h10l-5 6zm0-6V4"}
          fill="currentColor"
        />
      </svg>
      {up ? "Up" : "Down"}
    </span>
  );
}

export function LeaderboardCard({
  rank,
  username,
  avatarUrl,
  score,
  trend,
  profileHref,
  scoreLabel = "Score",
}: LeaderboardCardProps) {
  const podium = PODIUM[rank];

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        podium ?? "border-zinc-800 bg-zinc-900/70 text-zinc-100"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            rank === 1
              ? "bg-amber-400 text-zinc-950"
              : rank === 2
                ? "bg-zinc-200 text-zinc-950"
                : rank === 3
                  ? "bg-orange-700 text-white"
                  : "bg-zinc-800 text-zinc-200"
          }`}
          aria-label={`Rank ${rankLabel(rank)}`}
        >
          {rankLabel(rank)}
        </div>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium">
            {initials(username)}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold leading-tight">{username}</h3>
          <TrendIcon trend={trend} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <p className="text-right">
          <span className="block text-xs uppercase tracking-wide text-zinc-400">{scoreLabel}</span>
          <span className="text-2xl font-semibold tabular-nums">{score.toFixed(1)}</span>
        </p>
        <a
          href={profileHref}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
        >
          View Profile
        </a>
      </div>
    </article>
  );
}
