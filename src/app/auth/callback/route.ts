import { NextResponse } from 'next/server';
import {
  AGE_VERIFICATION_COOKIE,
  ageVerificationCookieOptions,
  signAgeVerificationCookie,
} from '@/lib/age-cookie';
import { safeNextPath } from '@/lib/auth';
import { clientIpHash } from '@/lib/http';
import { createServerSupabase } from '@/lib/supabase/server';
import { syncCurrentAccount } from '@/lib/sync-account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth', url.origin));
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth', url.origin));
  }

  try {
    const account = await syncCurrentAccount(clientIpHash(request));
    const destination = account.ageVerification === true ? next : '/verify-age';
    const response = NextResponse.redirect(new URL(destination, url.origin));
    if (account.ageVerification === true) {
      const token = await signAgeVerificationCookie(account.id);
      response.cookies.set(AGE_VERIFICATION_COOKIE, token, ageVerificationCookieOptions);
    }
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=sync', url.origin));
  }
}
