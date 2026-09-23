import { z } from "zod";

export const auditActions = [
  "login",
  "logout",
  "upload",
  "delete",
  "report",
  "payment",
  "settings_change",
] as const;

export const auditActionSchema = z.enum(auditActions);

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const auditQuerySchema = z.object({
  userId: z.string().min(1).max(200).optional(),
  action: auditActionSchema.optional(),
  from: daySchema.optional(),
  to: daySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  format: z.enum(["json", "csv"]).default("json"),
  q: z.string().max(200).optional(),
});

const checked = z
  .union([z.literal(true), z.literal("true"), z.literal("on"), z.literal("yes")])
  .transform(() => true as const);

export const dmcaClaimSchema = z.object({
  contentUrl: z.string().url().max(2000),
  description: z.string().trim().min(20).max(5000),
  contactInfo: z.string().trim().min(5).max(500),
  signature: checked,
});

export const dmcaCounterSchema = z.object({
  claimId: z.string().min(1).max(200),
  statement: z.string().trim().min(20).max(5000),
  contactInfo: z.string().trim().min(5).max(500),
});

export const dmcaReviewSchema = z.object({
  claimId: z.string().min(1).max(200),
  decision: z.enum(["approve", "reject", "lawsuit"]),
});

export const deleteAccountSchema = z.object({
  confirmation: z.enum(["DELETE", "CANCEL"]),
});

export function startOfUtcDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function endOfUtcDay(day: string): Date {
  return new Date(`${day}T23:59:59.999Z`);
}
