import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServer, isAuthConfigured } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export type VerifiedProfile = {
  id: string;
  email: string | null;
  age_verified: boolean;
  role: string;
  stripe_customer_id: string | null;
};

export type AdminUser = {
  id: string;
  role: string;
};

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? '').trim().toUpperCase();
}

function isStaffRole(role: string): boolean {
  return role === 'ADMIN' || role === 'MODERATOR';
}

/**
 * Staff-only gate for moderation APIs.
 * JWT role is checked first; the database role is the source of truth when present.
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) {
    return { error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { id: true, role: true, ageVerification: true },
  });

  const role = normalizeRole(dbUser?.role ?? token.role);
  if (!isStaffRole(role)) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  const ageOk =
    dbUser?.ageVerification === true ||
    token.ageVerification === true ||
    token.ageVerified === true;
  if (!ageOk) {
    return { error: NextResponse.json({ error: 'Age verification required' }, { status: 403 }) };
  }

  return { user: { id: token.sub, role } };
}

export async function requireVerifiedUser(): Promise<
  { profile: VerifiedProfile; email: string | null } | { error: NextResponse }
> {
  if (!isAuthConfigured()) {
    return { error: NextResponse.json({ error: 'Sign-in is not configured' }, { status: 503 }) };
  }

  const supabase = createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, age_verified, role, stripe_customer_id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('profile lookup failed', { code: profileError.code });
    return { error: NextResponse.json({ error: 'Could not load your account' }, { status: 500 }) };
  }

  if (!profile?.age_verified) {
    return {
      error: NextResponse.json(
        { error: 'Age verification is required before payments' },
        { status: 403 },
      ),
    };
  }

  return {
    email: data.user.email ?? null,
    profile: {
      id: profile.id,
      email: data.user.email ?? null,
      age_verified: profile.age_verified,
      role: profile.role,
      stripe_customer_id: profile.stripe_customer_id,
    },
  };
}
