import { z } from 'zod';
import { MAX_TIP_CENTS, MIN_TIP_CENTS, MIN_WITHDRAWAL_CENTS } from '@/lib/payments/money';

export const subscribeSchema = z.object({
  creatorId: z.string().uuid(),
  tierId: z.string().uuid(),
});

export const tipSchema = z.object({
  creatorId: z.string().uuid(),
  amountCents: z.number().int().min(MIN_TIP_CENTS).max(MAX_TIP_CENTS),
  idempotencyKey: z.string().uuid().optional(),
});

export const withdrawSchema = z.object({
  amountCents: z.number().int().min(MIN_WITHDRAWAL_CENTS).optional(),
});

export const earningsQuerySchema = z.object({
  period: z.enum(['this_month', 'last_month', 'all_time']).default('this_month'),
});

export const connectSchema = z.object({
  action: z.enum(['onboarding_link', 'account_session']),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
});

export function fieldPaths(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.path.join('.') || 'body');
}
