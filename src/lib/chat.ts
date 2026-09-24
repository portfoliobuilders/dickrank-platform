import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export const chatMessageSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(2000),
});

export const typingSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
  isTyping: z.boolean(),
});

export const openConversationSchema = z.object({
  username: z.string().trim().min(1).max(32),
});

const publicSender = { id: true, username: true, avatarUrl: true } as const;

export type ChatUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

type SessionToken = { sub?: string; id?: string } | null;

export function directKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join(':');
}

export async function chatUserFromToken(token: SessionToken): Promise<ChatUser> {
  const userId = token?.sub || token?.id;
  if (!userId) throw new ApiError(401, 'Sign in required');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...publicSender, ageVerification: true },
  });
  if (!user) throw new ApiError(401, 'Sign in required');
  if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
  return { id: user.id, username: user.username, avatarUrl: user.avatarUrl };
}

export async function requireChatUser(request: Request): Promise<ChatUser> {
  const token = await getToken({
    req: request as unknown as Parameters<typeof getToken>[0]['req'],
    secret: process.env.NEXTAUTH_SECRET,
  });
  return chatUserFromToken(token as SessionToken);
}

export async function assertMember(userId: string, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (!member) throw new ApiError(403, 'You are not in this conversation');
}

export async function saveChatMessage(userId: string, roomId: string, message: string) {
  if (!rateLimit(`chat:${userId}`, 20, 10_000)) throw new ApiError(429, 'Slow down');
  await assertMember(userId, roomId);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.message.create({
      data: { content: message, senderId: userId, conversationId: roomId },
      include: { sender: { select: publicSender } },
    });
    await tx.conversation.update({ where: { id: roomId }, data: { updatedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        userId,
        action: 'create',
        entityType: 'Message',
        entityId: saved.id,
        metadata: { conversationId: roomId },
      },
    });
    return saved;
  });
}

export async function listConversations(userId: string) {
  const rows = await prisma.conversationMember.findMany({
    where: { userId },
    orderBy: { conversation: { updatedAt: 'desc' } },
    include: {
      conversation: {
        include: {
          members: { include: { user: { select: publicSender } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.conversation.id,
    updatedAt: row.conversation.updatedAt,
    members: row.conversation.members.map((member) => member.user),
    lastMessage: row.conversation.messages[0] ?? null,
  }));
}

export async function listMessages(userId: string, conversationId: string) {
  await assertMember(userId, conversationId);
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { sender: { select: publicSender } },
  });
}

export async function openDirectConversation(userId: string, username: string) {
  const other = await prisma.user.findUnique({
    where: { username },
    select: { ...publicSender, ageVerification: true },
  });
  if (!other || other.ageVerification !== true) throw new ApiError(404, 'Member not found');
  if (other.id === userId) throw new ApiError(400, 'Choose another member');
  const key = directKey(userId, other.id);
  const existing = await prisma.conversation.findUnique({ where: { directKey: key } });
  if (existing) return existing;

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.conversation.create({
        data: {
          directKey: key,
          members: { create: [{ userId }, { userId: other.id }] },
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'create',
          entityType: 'Conversation',
          entityId: created.id,
          metadata: { withUserId: other.id },
        },
      });
      return created;
    });
  } catch (error) {
    const again = await prisma.conversation.findUnique({ where: { directKey: key } });
    if (again) return again;
    throw error;
  }
}
