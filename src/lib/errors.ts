import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
