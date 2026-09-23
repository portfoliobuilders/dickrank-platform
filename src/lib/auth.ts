import type { Profile, User } from '@prisma/client';
import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { redirect } from 'next/navigation';
import { HttpError } from '@/lib/errors';
import { hashLookup } from '@/lib/encryption';
import { verifyPassword } from '@/lib/passwords';
import { getPrisma } from '@/lib/prisma';
import { safeNextPath } from '@/lib/safe-path';
import { credentialsSchema } from '@/lib/validations';

export { safeNextPath };

export type AccountWithProfile = User & { profile: Profile | null };

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 4 },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const account = await getPrisma().user.findUnique({
          where: { emailHash: hashLookup(parsed.data.email) },
          select: {
            id: true,
            username: true,
            passwordHash: true,
            emailVerifiedAt: true,
            ageVerification: true,
            verificationStatus: true,
          },
        });

        const passwordMatches = account
          ? await verifyPassword(parsed.data.password, account.passwordHash)
          : false;
        if (!account || !passwordMatches || !account.emailVerifiedAt) return null;

        return {
          id: account.id,
          name: account.username,
          username: account.username,
          ageVerification: account.ageVerification === true,
          ageVerified: account.ageVerification === true,
          verificationStatus: account.verificationStatus,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? token.sub;
      if (!userId) return token;
      try {
        const row = await getPrisma().user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            role: true,
            ageVerification: true,
            verificationStatus: true,
          },
        });
        if (!row) return token;
        token.sub = row.id;
        token.name = row.username;
        token.username = row.username;
        token.role = row.role;
        token.ageVerification = row.ageVerification === true;
        token.ageVerified = row.ageVerification === true;
        token.verificationStatus = row.verificationStatus;
        delete token.email;
      } catch (error) {
        console.error(error instanceof Error ? error.name : 'session refresh failed');
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? '';
      session.user.username = typeof token.username === 'string' ? token.username : '';
      session.user.ageVerification = token.ageVerification === true;
      session.user.ageVerified = token.ageVerified === true;
      session.user.verificationStatus =
        typeof token.verificationStatus === 'string' ? token.verificationStatus : 'PENDING';
      delete session.user.email;
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },
};

export async function getSessionUser(): Promise<{ authUserId: string; email: string | null } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { authUserId: session.user.id, email: session.user.email ?? null };
}

export async function requireAccount(): Promise<AccountWithProfile> {
  const session = await getSessionUser();
  if (!session) throw new HttpError('Sign in required', 401);
  try {
    const account = await getPrisma().user.findUnique({
      where: { id: session.authUserId },
      include: { profile: true },
    });
    if (!account) throw new HttpError('Sign in required', 401);
    return account;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error(error instanceof Error ? error.name : 'account lookup failed');
    throw new HttpError('Account service is unavailable', 503);
  }
}

export async function requireVerifiedUser(): Promise<AccountWithProfile> {
  const account = await requireAccount();
  if (account.ageVerification !== true) {
    throw new HttpError('Age verification required', 403, 'AGE_VERIFICATION');
  }
  return account;
}

export async function requirePageUser(): Promise<AccountWithProfile | null> {
  try {
    return await requireVerifiedUser();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect('/login');
    if (error instanceof HttpError && error.code === 'AGE_VERIFICATION') redirect('/verify-age');
    if (error instanceof HttpError && error.status === 503) return null;
    throw error;
  }
}

export async function requirePageAccount(): Promise<AccountWithProfile | null> {
  try {
    return await requireAccount();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect('/login');
    if (error instanceof HttpError && error.status === 503) return null;
    throw error;
  }
}
