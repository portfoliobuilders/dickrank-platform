export const CONTENT_TYPES = [
  { id: "video", label: "Video" },
  { id: "photo", label: "Photo" },
  { id: "story", label: "Story" },
  { id: "live", label: "Live" },
] as const;

export const RATING_CATEGORY_OPTIONS = [
  { id: "feel", label: "Feel" },
  { id: "performance", label: "Performance" },
  { id: "experience", label: "Experience" },
  { id: "userExperience", label: "User experience" },
] as const;

export const PERIOD_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
] as const;

export const LEADERBOARD_CACHE_TTL_SECONDS = 15 * 60;

export function boardLabel(category: string): string {
  if (category === "overall") return "overall";
  if (category === "rising") return "rising stars";
  if (category === "userExperience") return "user experience";
  return category;
}

export function periodLabel(period: string): string {
  return PERIOD_OPTIONS.find((option) => option.id === period)?.label ?? period;
}
