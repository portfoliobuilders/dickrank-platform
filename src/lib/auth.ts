import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export type AuthedUser = {
  id: string;
  ageVerified: true;
};

export type AuthFailure = {
  ok: false;
  status: 401 | 403;
  error: string;
};

export type AuthSuccess = {
  ok: true;
  user: AuthedUser;
};

function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Confirms the caller is signed in and age-verified.
 * The database flag is the source of truth once a profile exists.
 * A brand-new profile can be created only from Supabase app_metadata,
 * which the user cannot edit themselves.
 */
export async function requireAgeVerifiedUser(request: Request): Promise<AuthSuccess | AuthFailure> {
  const token = readBearer(request);
  if (!token) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const userId = data.user.id;
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  const metadataFlag = data.user.app_metadata?.ageVerified === true;

  if (!existing) {
    if (!metadataFlag) {
      return { ok: false, status: 403, error: "Age verification required." };
    }
    await prisma.user.create({
      data: { id: userId, ageVerified: true },
    });
    return { ok: true, user: { id: userId, ageVerified: true } };
  }

  if (existing.ageVerified !== true) {
    return { ok: false, status: 403, error: "Age verification required." };
  }

  return { ok: true, user: { id: userId, ageVerified: true } };
}
