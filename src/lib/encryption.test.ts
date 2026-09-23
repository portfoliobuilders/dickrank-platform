import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decryptJson, encryptJson } from './encryption';

process.env.ENCRYPTION_KEY = 'test-encryption-key-1234567890ab';
process.env.DATA_BACKEND = 'memory';

test('encrypts and decrypts preference payloads', () => {
  const payload = {
    showOnlineStatus: true,
    allowMessages: false,
    hideFromSearch: true,
    notificationEmail: 'private@example.com',
  };
  const encrypted = encryptJson(payload);
  assert.notEqual(encrypted, JSON.stringify(payload));
  assert.ok(!encrypted.includes('private@example.com'));
  assert.deepEqual(decryptJson(encrypted), payload);
});

test('returns null for tampered ciphertext', () => {
  const encrypted = encryptJson({ ok: true });
  assert.equal(decryptJson(encrypted.slice(0, -2) + 'aa'), null);
});
