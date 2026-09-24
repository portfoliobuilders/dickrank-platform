import type { Server as HttpServer } from 'http';
import { NextResponse } from 'next/server';
import { initChatSocket } from '@/lib/chat-socket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GlobalChat = typeof globalThis & { io?: unknown; httpServer?: HttpServer };

export async function GET() {
  const ready = Boolean((globalThis as GlobalChat).io);
  return NextResponse.json({ success: ready });
}

export async function POST() {
  const g = globalThis as GlobalChat;
  if (g.io) {
    return NextResponse.json({ message: 'Socket already initialized', success: true });
  }
  if (!g.httpServer) {
    return NextResponse.json(
      { success: false, message: 'Chat socket starts with the Node server' },
      { status: 503 },
    );
  }
  initChatSocket(g.httpServer);
  return NextResponse.json({ success: true });
}
