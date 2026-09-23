import { createClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptPii, hashEmail } from "@/lib/crypto";
import { HttpError } from "@/lib/http";

export type AppUser = {
  id: string;
  role: "USER" | "ADMIN";
  ageVerified: boolean;
  emailEncrypted: string;
  displayName: string | null;
  anonymizedAt: Date | null;
  terminatedAt: Date | null;
  deletionExecuteAt: Date | null;
  stripeAccountId: string | null;
};

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerFromHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function accessTokenFromRequest(req?: NextRequest): Promise<string | null> {
  if (req) {
    const headerToken = bearerFromHeader(req.headers.get("authorization"));
    if (headerToken) return headerToken;
    const cookieToken = req.cookies.get("sb-access-token")?.value;
    if (cookieToken) return cookieToken;
  }
  const jar = cookies();
  return jar.get("sb-access-token")?.value ?? null;
}

async function profileForAuthUser(authUser: SupabaseAuthUser): Promise<AppUser> {
  const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (existing) return existing;
  const email = authUser.email ?? `${authUser.id}@users.dickrank.online`;
  return prisma.user.create({
    data: {
      id: authUser.id,
      emailEncrypted: encryptPii(email),
      emailHash: hashEmail(email),
      role: "USER",
      ageVerified: false,
    },
  });
}

async function userFromDevHeader(req?: NextRequest): Promise<AppUser | null> {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_AUTH !== "true") {
    return null;
  }
  const userId = req?.headers.get("x-dev-user-id") ?? cookies().get("dev-user-id")?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user;
}

export async function getCurrentUser(req?: NextRequest): Promise<AppUser | null> {
  const devUser = await userFromDevHeader(req);
  if (devUser) return devUser;

  const token = await accessTokenFromRequest(req);
  if (!token) return null;
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return profileForAuthUser(data.user);
}

export async function requireUser(req?: NextRequest): Promise<AppUser> {
  const user = await getCurrentUser(req);
  if (!user || user.anonymizedAt) {
    throw new HttpError(401, "Sign in required");
  }
  return user;
}

export async function requireAdmin(req?: NextRequest): Promise<AppUser> {
  const user = await requireUser(req);
  if (user.role !== "ADMIN" || !user.ageVerified) {
    throw new HttpError(403, "Admin access required");
  }
  return user;
}
