export const CONTENT_CATEGORIES = [
  { value: "AMATEUR", label: "Amateur" },
  { value: "ANAL", label: "Anal" },
  { value: "BDSM", label: "BDSM" },
  { value: "BLONDE", label: "Blonde" },
  { value: "BLOWJOB", label: "Blowjob" },
  { value: "BRUNETTE", label: "Brunette" },
  { value: "COSPLAY", label: "Cosplay" },
  { value: "CREAMPIE", label: "Creampie" },
  { value: "CUMSHOT", label: "Cumshot" },
  { value: "FETISH", label: "Fetish" },
  { value: "GROUP", label: "Group" },
  { value: "HARDCORE", label: "Hardcore" },
  { value: "INTERRACIAL", label: "Interracial" },
  { value: "LESBIAN", label: "Lesbian" },
  { value: "MASSAGE", label: "Massage" },
  { value: "MASTURBATION", label: "Masturbation" },
  { value: "MILF", label: "MILF" },
  { value: "ORAL", label: "Oral" },
  { value: "POV", label: "POV" },
  { value: "REDHEAD", label: "Redhead" },
  { value: "ROLEPLAY", label: "Roleplay" },
  { value: "ROMANTIC", label: "Romantic" },
  { value: "SOLO", label: "Solo" },
  { value: "THREESOME", label: "Threesome" },
  { value: "TOYS", label: "Toys" },
  { value: "VINTAGE", label: "Vintage" },
] as const;

export const CATEGORY_VALUES = CONTENT_CATEGORIES.map((category) => category.value);

export type ContentCategoryValue = (typeof CATEGORY_VALUES)[number];

export const PRIVACY_OPTIONS = [
  { value: "PUBLIC", label: "Public", description: "Anyone can see this after it is approved" },
  { value: "PRIVATE", label: "Private", description: "Only you can see this" },
  { value: "PREMIUM", label: "Premium", description: "Only paying subscribers can see this" },
] as const;

export type ContentPrivacyValue = (typeof PRIVACY_OPTIONS)[number]["value"];
