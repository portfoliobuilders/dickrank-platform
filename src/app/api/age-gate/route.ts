import { NextResponse } from 'next/server';
import { AGE_GATE_COOKIE, ageGateCookieOptions } from '@/lib/age-cookie';
import { withApi } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AGE_GATE_COOKIE, 'confirmed', ageGateCookieOptions);
  return response;
});
