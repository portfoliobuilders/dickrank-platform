import type { Server as HttpServer } from 'http';
import { getToken } from 'next-auth/jwt';
import { Server } from 'socket.io';
import { ApiError } from '@/lib/errors';
import {
  assertMember,
  chatMessageSchema,
  chatUserFromToken,
  saveChatMessage,
  typingSchema,
} from '@/lib/chat';

type GlobalChat = typeof globalThis & { io?: Server; httpServer?: HttpServer };

export function getChatIo() {
  return (globalThis as GlobalChat).io;
}

export function publishChatMessage(roomId: string, message: unknown) {
  getChatIo()?.to(roomId).emit('new-message', message);
}

export function initChatSocket(httpServer: HttpServer) {
  const g = globalThis as GlobalChat;
  if (g.io) return g.io;

  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL;
  const io = new Server(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: origin || true,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = await getToken({
        req: socket.request as unknown as Parameters<typeof getToken>[0]['req'],
        secret: process.env.NEXTAUTH_SECRET,
      });
      const user = await chatUserFromToken(token);
      socket.data.userId = user.id;
      next();
    } catch (error) {
      next(error instanceof ApiError ? new Error(error.message) : new Error('Sign in required'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    console.log('User connected:', socket.id);

    socket.on('join-room', async (roomId: string) => {
      if (typeof roomId !== 'string') return;
      try {
        await assertMember(userId, roomId);
        await socket.join(roomId);
      } catch {
        socket.emit('message-error', { error: 'You are not in this conversation' });
      }
    });

    socket.on('send-message', async (data: unknown) => {
      const parsed = chatMessageSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit('message-error', { error: 'Invalid message' });
        return;
      }
      try {
        const saved = await saveChatMessage(userId, parsed.data.roomId, parsed.data.message);
        io.to(parsed.data.roomId).emit('new-message', saved);
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Could not send';
        socket.emit('message-error', { error: message });
      }
    });

    socket.on('typing', async (data: unknown) => {
      const parsed = typingSchema.safeParse(data);
      if (!parsed.success) return;
      try {
        await assertMember(userId, parsed.data.roomId);
        socket.to(parsed.data.roomId).emit('user-typing', { userId, isTyping: parsed.data.isTyping });
      } catch {
        socket.emit('message-error', { error: 'You are not in this conversation' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  g.io = io;
  g.httpServer = httpServer;
  return io;
}
