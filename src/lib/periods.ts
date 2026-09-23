export const PERIODS = ["today", "week", "month", "all"] as const;

export type Period = (typeof PERIODS)[number];

export type TimeWindow = {
  start: Date | null;
  end: Date | null;
};

function startOfUtcDay(date: Date): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function periodWindow(period: Period, now = new Date()): TimeWindow {
  if (period === "all") return { start: null, end: null };
  if (period === "today") return { start: startOfUtcDay(now), end: null };
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (period === "week" ? 7 : 30));
  return { start, end: null };
}

/** The window just before `period`, used to measure who is rising. */
export function previousPeriodWindow(period: Period, now = new Date()): TimeWindow {
  if (period === "today") {
    const end = startOfUtcDay(now);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 1);
    return { start, end };
  }

  const days = period === "week" ? 7 : 30;
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - days);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return { start, end };
}
