export const PAGE_SIZE = 12;

export const ORIENTATION_OPTIONS = [
  { value: "straight", label: "Straight" },
  { value: "gay", label: "Gay" },
  { value: "lesbian", label: "Lesbian" },
  { value: "bisexual", label: "Bisexual" },
  { value: "pansexual", label: "Pansexual" },
  { value: "queer", label: "Queer" },
  { value: "asexual", label: "Asexual" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
] as const;

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "copyright", label: "Copyright" },
  { value: "non_consensual", label: "Non-consensual" },
  { value: "harassment", label: "Harassment" },
  { value: "underage", label: "Someone appears under 18" },
  { value: "other", label: "Other" },
] as const;

export const DEFAULT_PREFERENCES = {
  privateAccount: false,
  showActivity: true,
  allowSubscriptions: true,
  emailDigest: false,
  notificationEmail: "",
  contentWarnings: true,
} as const;
