import { NextResponse } from 'next/server';
import type { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { writeAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { createSupabaseServer, isAuthConfigured } from '@/lib/supabase/server';
import { credentialsSchema } from '@/lib/validations';

function googleUsername(email: string | undefined, subject: string): string {
  const base = (email?.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12) || 'user';
  return `${base}_${subject.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          username: googleUsername(profile.email, profile.sub),
          ageVerified: false,
          ageVerification: false,
          verificationStatus: 'PENDING',
          role: 'USER',
        };
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!parsed.success) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!user?.password) {
          throw new Error('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(parsed.data.password, user.password);

        if (!isPasswordValid) {
          throw new Error('Invalid credentials');
        }

        const ageVerified = user.ageVerified === true || user.ageVerification === true;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName || user.username,
          image: user.avatarUrl ?? user.image,
          username: user.username,
          ageVerified,
          ageVerification: ageVerified,
          verificationStatus: user.verificationStatus,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const ageVerified = user.ageVerified === true || user.ageVerification === true;
        token.ageVerified = ageVerified;
        token.ageVerification = ageVerified;
        token.verificationStatus = user.verificationStatus;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub ?? '';
        session.user.username = token.username ?? '';
        session.user.ageVerified = token.ageVerified === true;
        session.user.ageVerification = token.ageVerification === true;
        session.user.verificationStatus = token.verificationStatus ?? 'PENDING';
        session.user.role = token.role;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (!user.id) return false;

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { banned: true, ageVerified: true },
      });

      if (dbUser?.banned) {
        return false;
      }

      if (isSupabaseConfigured()) {
        await writeAuditLog({
          actorId: user.id,
          action: 'create',
          entity: 'session',
          entityId: user.id,
          metadata: {
            provider: account?.provider ?? 'unknown',
            ageVerified: dbUser?.ageVerified === true,
          },
        });
      }

      return true;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

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
