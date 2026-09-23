import { NextResponse } from 'next/server';
import {
  AGE_VERIFICATION_COOKIE,
  ageVerificationCookieOptions,
  signAgeVerificationCookie,
} from '@/lib/age-cookie';
import { requireAccount } from '@/lib/auth';
import { HttpError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const account = await requireAccount();
    if (account.ageVerification !== true) {
      return NextResponse.redirect(new URL('/verify-age', request.url));
    }
    const token = await signAgeVerificationCookie(account.id);
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    response.cookies.set(AGE_VERIFICATION_COOKIE, token, ageVerificationCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.redirect(new URL('/verify-age', request.url));
  }
}
