'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Paperclip, Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeAvatarUrl } from '@/lib/avatar';

export type ChatSender = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type ChatMessage = {
  id: string;
  content: string;
  senderId?: string;
  conversationId?: string;
  createdAt: string;
  sender: ChatSender;
};

export type ChatInterfaceProps = {
  conversationId: string;
  currentUserId: string;
  otherUser: {
    username: string;
    avatarUrl: string | null;
    isOnline?: boolean;
  };
};

function messageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Avatar({ name, url, size }: { name: string; url: string | null; size: number }) {
  const safe = safeAvatarUrl(url);
  const initial = name.slice(0, 1).toUpperCase() || '?';
  if (!safe) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-white"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }
  return (
    <img
      src={safe}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function ChatInterface({ conversationId, currentUserId, otherUser }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;

    const load = () => {
      fetch(`/api/chat/conversations/${conversationId}/messages`)
        .then(async (response) => {
          if (!response.ok) throw new Error('Could not load this conversation');
          return response.json() as Promise<ChatMessage[]>;
        })
        .then((rows) => {
          if (!cancelled) setMessages(rows);
        })
        .catch((fetchError: unknown) => {
          if (!cancelled) {
            setError(fetchError instanceof Error ? fetchError.message : 'Could not load this conversation');
          }
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
          socket?.emit('join-room', conversationId);
        });
        socket.on('new-message', (message: ChatMessage) => {
          if (message.conversationId && message.conversationId !== conversationId) return;
          setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
        });
        socket.on('user-typing', (data: { userId: string; isTyping: boolean }) => {
          if (data.userId === currentUserId) return;
          setIsTyping(data.isTyping);
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
      setIsTyping(false);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const text = inputMessage.trim();
    if (!text) return;
    setError('');
    setInputMessage('');
    socketRef.current?.emit('typing', { roomId: conversationId, isTyping: false });

    const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'Could not send');
      setInputMessage(text);
      return;
    }
    setMessages((current) => (current.some((item) => item.id === body.id) ? current : [...current, body]));
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-zinc-800 p-4">
        <div className="relative">
          <Avatar name={otherUser.username} url={otherUser.avatarUrl} size={40} />
          {otherUser.isOnline ? (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-zinc-900 bg-green-500" />
          ) : null}
        </div>
        <div>
          <h3 className="font-semibold text-white">{otherUser.username}</h3>
          <p className="text-sm text-zinc-500">
            {isTyping ? 'Typing...' : otherUser.isOnline || live ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => {
          const mine = message.sender.id === currentUserId;
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${mine ? 'bg-amber-600' : 'bg-zinc-800'}`}>
                <p className="text-white">{message.content}</p>
                <span className="mt-1 block text-xs text-white/60">{messageTime(message.createdAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {error ? <p className="px-4 text-sm text-red-300">{error}</p> : null}

      <div className="flex gap-2 border-t border-zinc-800 p-4">
        <button type="button" className="p-2 text-zinc-400" disabled title="File attachments are not available yet">
          <Paperclip size={20} />
        </button>
        <input
          type="text"
          value={inputMessage}
          onChange={(event) => {
            const value = event.target.value;
            setInputMessage(value);
            socketRef.current?.emit('typing', { roomId: conversationId, isTyping: value.trim().length > 0 });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-white focus:border-amber-500 focus:outline-none"
        />
        <button type="button" className="p-2 text-zinc-400" disabled title="Emoji picker is not available yet">
          <Smile size={20} />
        </button>
        <Button
          type="button"
          onClick={() => void sendMessage()}
          className="rounded-full bg-amber-500 px-6 text-black hover:bg-amber-600"
        >
          <Send size={18} />
        </Button>
      </div>
    </div>
  );
}
