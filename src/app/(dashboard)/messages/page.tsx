import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getToken } from 'next-auth/jwt';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { prisma } from '@/lib/prisma';

export default async function MessagesPage() {
  const token = await getToken({
    req: { headers: { cookie: cookies().toString() } } as Parameters<typeof getToken>[0]['req'],
    secret: process.env.NEXTAUTH_SECRET,
  });
  const userId = token?.sub;
  if (!userId) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, ageVerification: true },
  });
  if (!user) redirect('/login');
  if (user.ageVerification !== true) redirect('/verify-age');

  return (
    <main>
      <h1 className="text-3xl font-semibold">Messages</h1>
      <p className="mt-2 mb-6 text-sm text-zinc-400">Private chat for age-verified members.</p>
      <ChatPanel userId={user.id} />
    </main>
  );
}
