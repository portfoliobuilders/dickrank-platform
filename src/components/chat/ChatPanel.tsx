'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChatInterface, type ChatMessage, type ChatSender } from '@/components/chat/ChatInterface';

type Conversation = {
  id: string;
  updatedAt: string;
  members: ChatSender[];
  lastMessage: ChatMessage | null;
};

export function ChatPanel({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

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
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
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
      <section className="min-h-[520px]">
        {active && other ? (
          <ChatInterface
            conversationId={active.id}
            currentUserId={userId}
            otherUser={{ username: other.username, avatarUrl: other.avatarUrl }}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-400">
            Choose a conversation
          </div>
        )}
      </section>
    </div>
  );
}
