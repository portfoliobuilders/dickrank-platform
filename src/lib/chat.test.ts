import { describe, expect, it } from 'vitest';
import { chatMessageSchema, directKey, openConversationSchema } from '@/lib/chat';

describe('chat rules', () => {
  it('builds the same direct key either way', () => {
    expect(directKey('b', 'a')).toBe(directKey('a', 'b'));
    expect(directKey('a', 'b')).toBe('a:b');
  });

  it('rejects an empty message and a message that is too long', () => {
    expect(chatMessageSchema.safeParse({ roomId: 'room', message: '   ' }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ roomId: 'room', message: 'x'.repeat(2001) }).success).toBe(false);
    expect(chatMessageSchema.parse({ roomId: ' room ', message: ' hello ' })).toEqual({
      roomId: 'room',
      message: 'hello',
    });
  });

  it('requires a username to open a conversation', () => {
    expect(openConversationSchema.safeParse({ username: '' }).success).toBe(false);
    expect(openConversationSchema.parse({ username: ' member ' }).username).toBe('member');
  });
});
