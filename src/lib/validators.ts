import { z } from 'zod';

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'copyright',
  'non_consensual',
  'underage',
  'other',
] as const;

export const ORIENTATIONS = [
  'straight',
  'gay',
  'lesbian',
  'bisexual',
  'pansexual',
  'asexual',
  'queer',
  'prefer_not_to_say',
] as const;

export const preferencesSchema = z.object({
  showOnlineStatus: z.boolean(),
  allowMessages: z.boolean(),
  hideFromSearch: z.boolean(),
});

export const qualitySchema = z.object({
  label: z.string().trim().min(1).max(20),
  url: z.string().url().max(2000),
});

export const contentListQuerySchema = z.object({
  category: z.string().trim().min(1).max(40).optional(),
  tags: z.string().trim().max(200).optional(),
  sort: z.enum(['newest', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  filter: z.enum(['following', 'popular', 'new', 'premium']).optional(),
  creator: z.string().trim().min(1).max(32).optional(),
});

export const createContentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
  category: z.string().trim().min(1).max(40).optional(),
  mediaUrl: z.string().url().max(2000),
  thumbnailUrl: z.string().url().max(2000).optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  qualities: z.array(qualitySchema).max(6).optional(),
  isPremium: z.boolean().default(false),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  rating: z.number().min(0).max(5).optional(),
});

export const updateContentSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
    category: z.string().trim().min(1).max(40).nullable().optional(),
    thumbnailUrl: z.string().url().max(2000).nullable().optional(),
    isPremium: z.boolean().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    qualities: z.array(qualitySchema).max(6).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(500),
  location: z.string().trim().max(80),
  orientation: z.enum(ORIENTATIONS).nullable(),
  interests: z.array(z.string().trim().min(1).max(32)).max(12),
  preferences: preferencesSchema,
});

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
});

export const idParamSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
export const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/);

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ContentListQuery = z.infer<typeof contentListQuerySchema>;
