import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from '@/lib/errors';
import { hashIp } from '@/lib/encryption';

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    return first || null;
  }
  return request.headers.get('x-real-ip');
}

export function clientIpHash(request: Request): string | null {
  try {
    return hashIp(clientIp(request));
  } catch {
    return null;
  }
}

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

export function withApi(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonError(error.message, error.status, error.code);
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Check the form and try again.', issues: error.flatten() },
          { status: 400 },
        );
      }
      console.error(error instanceof Error ? error.name : 'request failed');
      return jsonError('Something went wrong. Try again in a moment.', 500);
    }
  };
}
