import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBackendMode } from '@/lib/backend';
import { ensureLocalDemoUser, getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import type { SessionUser } from '@/lib/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const SESSION_COOKIE = 'dr_session';

export async function getSessionUser(): Promise<SessionUser | null> {
  const mode = getBackendMode();
  if (mode === 'unconfigured') return null;
  if (mode === 'memory') {
    const id = cookies().get(SESSION_COOKIE)?.value;
    if (!id) return null;
    return getStore().getUserById(id);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return getStore().getUserByAuthId(data.user.id);
}

export async function requirePageUser(nextPath = '/feed'): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.ageVerification !== true) {
    redirect(`/age-verification?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requireApiUser(): Promise<SessionUser> {
  if (getBackendMode() === 'unconfigured') {
    throw new ApiError(503, 'Data backend is not configured');
  }
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, 'Sign in required');
  if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
  return user;
}

export function setMemorySession(userId: string) {
  cookies().set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function startLocalSession(): Promise<SessionUser> {
  const existing = await getSessionUser();
  if (existing) return existing;
  return ensureLocalDemoUser();
}
