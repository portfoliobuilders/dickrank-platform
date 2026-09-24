'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type Sender = { id: string; username: string; avatarUrl: string | null };
type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  createdAt: string;
  sender: Sender;
};
type Conversation = {
  id: string;
  updatedAt: string;
  members: Sender[];
  lastMessage: ChatMessage | null;
};

export function ChatPanel({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [username, setUsername] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const active = conversations.find((item) => item.id === activeId) ?? null;
  const other = useMemo(
    () => active?.members.find((member) => member.id !== userId) ?? null,
    [active, userId],
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/chat/conversations')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load messages');
        return response.json() as Promise<Conversation[]>;
      })
      .then((rows) => {
        if (!cancelled) setConversations(rows);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'Could not load messages');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let socket: Socket | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;

    const load = () => {
      fetch(`/api/chat/conversations/${activeId}/messages`)
        .then(async (response) => {
          if (!response.ok) throw new Error('Could not load this conversation');
          return response.json() as Promise<ChatMessage[]>;
        })
        .then((rows) => {
          if (!cancelled) setMessages(rows);
        })
        .catch((fetchError: unknown) => {
          if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'Could not load this conversation');
        });
    };

    load();
    fetch('/api/socket')
      .then((response) => response.json())
      .then((status: { success?: boolean }) => {
        if (cancelled || !status.success) {
          poll = setInterval(load, 3000);
          return;
        }
        socket = io({ path: '/api/socket/io' });
        socketRef.current = socket;
        socket.on('connect', () => {
          setLive(true);
          socket?.emit('join-room', activeId);
        });
        socket.on('new-message', (message: ChatMessage) => {
          if (message.conversationId !== activeId) return;
          setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
        });
        socket.on('user-typing', (data: { userId: string; isTyping: boolean }) => {
          if (data.userId === userId) return;
          setTyping(data.isTyping ? data.userId : null);
        });
        socket.on('message-error', (data: { error?: string }) => {
          setError(data.error || 'Message failed');
        });
        socket.on('disconnect', () => setLive(false));
      })
      .catch(() => {
        poll = setInterval(load, 3000);
      });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      socket?.disconnect();
      socketRef.current = null;
      setLive(false);
      setTyping(null);
    };
  }, [activeId, userId]);

  async function startChat(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'Could not start a conversation');
      return;
    }
    setUsername('');
    setActiveId(body.id);
    const list = await fetch('/api/chat/conversations').then((item) => item.json());
    setConversations(list);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!activeId || !draft.trim()) return;
    setError('');
    const response = await fetch(`/api/chat/conversations/${activeId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: draft }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'Could not send');
      return;
    }
    setDraft('');
    setMessages((current) => (current.some((item) => item.id === body.id) ? current : [...current, body]));
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <form onSubmit={startChat} className="space-y-2">
          <label className="block text-sm text-zinc-300" htmlFor="chat-username">
            Message a member
          </label>
          <input
            id="chat-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="username"
          />
          <button type="submit" className="rounded bg-white px-3 py-2 text-sm text-black">
            Open chat
          </button>
        </form>
        <ul className="space-y-2">
          {conversations.map((conversation) => {
            const name = conversation.members.find((member) => member.id !== userId)?.username ?? 'Conversation';
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className="w-full rounded border border-zinc-800 px-3 py-2 text-left text-sm"
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <section className="flex min-h-[420px] flex-col rounded border border-zinc-800">
        <header className="border-b border-zinc-800 px-4 py-3 text-sm">
          {other ? other.username : 'Choose a conversation'}
          {live ? <span className="ml-2 text-zinc-400">Live</span> : null}
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <p key={message.id} className="text-sm">
              <span className="font-medium">{message.sender.username}</span>
              <span className="text-zinc-300"> {message.content}</span>
            </p>
          ))}
          {typing ? <p className="text-xs text-zinc-400">Someone is typing</p> : null}
        </div>
        {error ? <p className="px-4 text-sm text-red-300">{error}</p> : null}
        <form onSubmit={send} className="flex gap-2 border-t border-zinc-800 p-3">
          <input
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              socketRef.current?.emit('typing', { roomId: activeId, isTyping: value.trim().length > 0 });
            }}
            className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="Write a message"
            disabled={!activeId}
          />
          <button type="submit" className="rounded bg-white px-3 py-2 text-sm text-black" disabled={!activeId}>
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
