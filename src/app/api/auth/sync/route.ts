import { NextResponse } from 'next/server';
import {
  AGE_VERIFICATION_COOKIE,
  ageVerificationCookieOptions,
  signAgeVerificationCookie,
} from '@/lib/age-cookie';
import { clientIpHash, withApi } from '@/lib/http';
import { syncCurrentAccount } from '@/lib/sync-account';
import type { AuthSyncResponse } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(async (request) => {
  const account = await syncCurrentAccount(clientIpHash(request));
  const body: AuthSyncResponse = { ageVerification: account.ageVerification === true };
  const response = NextResponse.json(body);
  if (account.ageVerification === true) {
    const token = await signAgeVerificationCookie(account.id);
    response.cookies.set(AGE_VERIFICATION_COOKIE, token, ageVerificationCookieOptions);
  }
  return response;
});
