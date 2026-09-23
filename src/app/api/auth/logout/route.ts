import { NextResponse } from 'next/server';
import { AGE_VERIFICATION_COOKIE, ageVerificationCookieOptions } from '@/lib/age-cookie';
import { withApi } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AGE_VERIFICATION_COOKIE, '', { ...ageVerificationCookieOptions, maxAge: 0 });
  return response;
});
