import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServer, isAuthConfigured } from '@/lib/supabase/server';

export type VerifiedProfile = {
  id: string;
  email: string | null;
  age_verified: boolean;
  role: string;
  stripe_customer_id: string | null;
};

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
