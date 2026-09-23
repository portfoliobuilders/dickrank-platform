import { z } from 'zod';
import { parseDateOnly } from '@/lib/age';

export const uploadSchema = z.object({
  title: z.string().trim().min(1, 'Add a title').max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value ? value : undefined)),
  visibility: z.enum(['PUBLIC', 'SUBSCRIBERS', 'PRIVATE']),
  confirmAdultSubjects: z.literal(true, {
    errorMap: () => ({ message: 'Confirm everyone shown is 18 or older' }),
  }),
  confirmRights: z.literal(true, {
    errorMap: () => ({ message: 'Confirm you have the rights to upload this' }),
  }),
});

export const rateSchema = z.object({
  contentId: z.string().cuid(),
  score: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  kind: z.enum(['content', 'creators']).default('content'),
});

export const ageVerifySchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth')
    .refine((value) => parseDateOnly(value) !== null, 'Enter a real date of birth'),
  accepted: z.literal(true, {
    errorMap: () => ({ message: 'Confirm you are 18 or older' }),
  }),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine((value) => !value || /^\+?[0-9 ().-]{7,20}$/.test(value), 'Enter a valid phone number')
    .transform((value) => value || undefined),
  idDocumentToken: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((value) => !value || value.length >= 4, 'Reference is too short')
    .transform((value) => value || undefined),
});

export const credentialsSchema = z.object({
  email: z.string().trim().email('Enter a valid email').max(320),
  password: z.string().min(8, 'Use at least 8 characters').max(72, 'Password is too long'),
});

export const registerSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email').max(320),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be 20 characters or fewer')
      .regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers, and underscores'),
    password: z.string().min(8, 'Use at least 8 characters').max(72, 'Password is too long'),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const emailCodeSchema = z.object({
  email: z.string().trim().email('Enter a valid email').max(320),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email').max(320),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20).max(200),
    password: z.string().min(8, 'Use at least 8 characters').max(72, 'Password is too long'),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const stripeMetadataSchema = z.object({
  subscriberId: z.string().cuid(),
  creatorId: z.string().cuid(),
});
