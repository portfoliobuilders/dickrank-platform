import { getSessionUser } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { getPrisma } from '@/lib/prisma';
import type { User } from '@prisma/client';

export async function syncCurrentAccount(_ipHash: string | null): Promise<User> {
  const session = await getSessionUser();
  if (!session) throw new HttpError('Sign in required', 401);
  const account = await getPrisma().user.findUnique({ where: { id: session.authUserId } });
  if (!account) throw new HttpError('Sign in required', 401);
  return account;
}
