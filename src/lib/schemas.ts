import { z } from "zod";

export const verificationStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export function parseVerificationStatus(value: string): VerificationStatus {
  if (value === "APPROVED" || value === "REJECTED") return value;
  return "PENDING";
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email").max(255),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be 20 characters or fewer")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can use letters, numbers, and underscores"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

export const emailCodeSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resendCodeSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  verificationStatus: VerificationStatus;
  ageVerified: boolean;
  emailVerified: string | null;
};

export function toPublicUser(user: {
  id: string;
  email: string;
  username: string;
  verificationStatus: string;
  ageVerified: boolean;
  emailVerified: Date | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    verificationStatus: parseVerificationStatus(user.verificationStatus),
    ageVerified: user.ageVerified,
    emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
  };
}
