import { z } from "zod";

import { PERIODS } from "@/lib/periods";

export const RATING_MIN = 1;
export const RATING_MAX = 10;

export function isHalfStep(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-8;
}

export const scoreSchema = z
  .number({ invalid_type_error: "Choose a score from 1 to 10." })
  .min(RATING_MIN, "Scores start at 1.")
  .max(RATING_MAX, "Scores go up to 10.")
  .refine(isHalfStep, "Use half-point steps, such as 7.5.");

export const createRatingSchema = z
  .object({
    contentId: z.string().trim().min(1).max(128),
    overall: scoreSchema,
    feel: scoreSchema,
    performance: scoreSchema,
    experience: scoreSchema,
    userExperience: scoreSchema,
    pros: z.string().trim().max(500, "Keep pros under 500 characters.").optional().default(""),
    cons: z.string().trim().max(500, "Keep cons under 500 characters.").optional().default(""),
    review: z
      .string()
      .trim()
      .min(20, "Write at least 20 characters so the review is useful.")
      .max(5000, "Keep the review under 5,000 characters."),
    anonymous: z.boolean().optional().default(false),
  })
  .strict();

export const ratingsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const slugSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,32}$/, "Use a short category name.");

export const leaderboardQuerySchema = z.object({
  category: slugSchema.default("overall"),
  period: z.enum(PERIODS).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  type: slugSchema.optional(),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
