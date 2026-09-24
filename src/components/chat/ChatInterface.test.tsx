import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChatInterface } from '@/components/chat/ChatInterface';

vi.stubGlobal(
  'fetch',
  vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })),
);

describe('chat interface', () => {
  it('shows the other member and a message box', () => {
    const markup = renderToStaticMarkup(
      createElement(ChatInterface, {
        conversationId: 'room-1',
        currentUserId: 'me',
        otherUser: { username: 'nova', avatarUrl: null, isOnline: true },
      }),
    );
    expect(markup).toContain('nova');
    expect(markup).toContain('Type a message...');
    expect(markup).toContain('Online');
  });
});
