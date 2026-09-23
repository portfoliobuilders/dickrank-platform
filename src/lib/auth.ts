import { createClient } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type SignedInUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  ageVerification: boolean;
  verified: boolean;
};

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Confirms the caller with Supabase, then loads the profile from our database.
 * Age and verification flags come from the database, not from the browser.
 */
export async function getSignedInUser(request: Request): Promise<SignedInUser | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new HttpError("Sign-in is not configured.", 500);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      ageVerification: true,
      verified: true,
    },
  });
  return user;
}

export async function requireVerifiedRater(request: Request): Promise<SignedInUser> {
  const user = await getSignedInUser(request);
  if (!user) throw new HttpError("Sign in to rate.", 401);
  if (user.ageVerification !== true || user.verified !== true) {
    throw new HttpError("Only verified 18+ members can rate content.", 403);
  }
  return user;
}
