import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicUser } from './public-user';
import { registerSchema } from './validations';

test('public user hides the password hash and email', () => {
  const createdAt = new Date('2026-09-23T00:00:00.000Z');
  const pub = toPublicUser({
    id: 'user_1',
    username: 'member',
    role: 'USER',
    verificationStatus: 'PENDING',
    ageVerification: false,
    emailVerifiedAt: null,
    createdAt,
    passwordHash: 'secret-hash',
    emailEncrypted: 'ciphertext',
  } as never);
  const serialized = JSON.stringify(pub);
  assert.equal(serialized.includes('secret-hash'), false);
  assert.equal(serialized.includes('ciphertext'), false);
  assert.equal(pub.ageVerification, false);
  assert.equal(pub.emailVerified, false);
  assert.equal(pub.verificationStatus, 'PENDING');
});

test('register schema rejects a mismatched password', () => {
  const parsed = registerSchema.safeParse({
    email: 'person@example.com',
    username: 'member',
    password: 'long-password',
    confirmPassword: 'other-password',
  });
  assert.equal(parsed.success, false);
});
