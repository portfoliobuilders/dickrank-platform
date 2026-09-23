import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/errors';

export function json<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}

export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) {
      return json({ error: 'Invalid request', issues: error.flatten() }, 400);
    }
    console.error(error);
    return json({ error: 'Something went wrong' }, 500);
  }
}
