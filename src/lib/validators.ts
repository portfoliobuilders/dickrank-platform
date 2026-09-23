import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max);

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"), "Use an https URL");

const labelText = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N} _-]+$/u, "Use letters, numbers, spaces, _ or -");

export const mediaQualitySchema = z.object({
  label: z.string().trim().min(1).max(20),
  src: httpsUrl,
});

export const preferencesSchema = z.object({
  privateAccount: z.boolean().default(false),
  showActivity: z.boolean().default(true),
  allowSubscriptions: z.boolean().default(true),
  emailDigest: z.boolean().default(false),
  notificationEmail: z.union([z.string().trim().email(), z.literal("")]).default(""),
  contentWarnings: z.boolean().default(true),
});

export const orientationSchema = z.enum([
  "straight",
  "gay",
  "lesbian",
  "bisexual",
  "pansexual",
  "queer",
  "asexual",
  "other",
  "undisclosed",
]);

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: optionalText(500).default(""),
  location: optionalText(120).default(""),
  orientation: orientationSchema,
  interests: z.array(labelText).max(20).default([]),
  avatarUrl: z.union([httpsUrl, z.literal("")]).optional(),
  preferences: preferencesSchema,
});

export const createContentSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: optionalText(5000).default(""),
  tags: z.array(labelText).max(20).default([]),
  category: z.string().trim().min(1).max(60),
  mediaUrl: httpsUrl,
  mediaType: z.enum(["image", "video"]),
  thumbnailUrl: httpsUrl.optional(),
  blurDataUrl: z
    .string()
    .max(20000)
    .refine((value) => value.startsWith("data:image/"), "Blur placeholder must be an image data URL")
    .optional(),
  isPremium: z.boolean().default(false),
  qualities: z.array(mediaQualitySchema).max(6).optional(),
});

export const updateContentSchema = z
  .object({
    title: z.string().trim().min(1).max(140).optional(),
    description: optionalText(5000).optional(),
    tags: z.array(labelText).max(20).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    mediaUrl: httpsUrl.optional(),
    mediaType: z.enum(["image", "video"]).optional(),
    thumbnailUrl: httpsUrl.nullable().optional(),
    blurDataUrl: z
      .string()
      .max(20000)
      .refine((value) => value.startsWith("data:image/"), "Blur placeholder must be an image data URL")
      .nullable()
      .optional(),
    isPremium: z.boolean().optional(),
    qualities: z.array(mediaQualitySchema).max(6).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "No changes provided",
  });

export const listContentQuerySchema = z.object({
  category: z.string().trim().min(1).max(60).optional(),
  tags: z.array(labelText).max(20).optional(),
  sort: z.enum(["newest", "popular"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  feed: z.enum(["following", "popular", "new", "premium"]).optional(),
  creator: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,30}$/, "Invalid username")
    .optional(),
});

export const contentIdSchema = z.string().uuid();

export const usernameSchema = z.string().trim().regex(/^[a-zA-Z0-9_]{3,30}$/, "Invalid username");

export const reportSchema = z.object({
  reason: z.enum(["spam", "copyright", "non_consensual", "harassment", "underage", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export const ageVerificationSchema = z.object({
  confirmedAdult: z.literal(true, {
    errorMap: () => ({ message: "Confirm that you are 18 or older" }),
  }),
});

export function parseTagParam(value: string | null) {
  if (!value) return undefined;
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}
