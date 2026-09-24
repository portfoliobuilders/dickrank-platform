import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emailErrorMessage } from './email';

describe('emailErrorMessage', () => {
  it('truncates long messages', () => {
    const long = 'x'.repeat(600);
    const message = emailErrorMessage(new Error(long));
    assert.equal(message.length, 500);
  });

  it('handles non-Error values', () => {
    assert.equal(emailErrorMessage('boom'), 'Unknown email error');
    assert.equal(emailErrorMessage(null), 'Unknown email error');
  });
});
