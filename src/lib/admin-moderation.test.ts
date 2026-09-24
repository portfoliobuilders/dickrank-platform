import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveAiScore, deriveFlags, statusesForTab, tabForStatus } from './admin-moderation';
import { ModerationStatus } from '@prisma/client';

describe('admin moderation helpers', () => {
  it('maps tabs to database statuses', () => {
    assert.deepEqual(statusesForTab('approved'), [ModerationStatus.APPROVED]);
    assert.deepEqual(statusesForTab('rejected'), [ModerationStatus.REJECTED]);
    assert.ok(statusesForTab('pending').includes(ModerationStatus.FLAGGED));
    assert.equal(tabForStatus(ModerationStatus.MANUAL_REVIEW), 'pending');
  });

  it('derives the highest AI confidence score', () => {
    assert.equal(deriveAiScore(null), 0);
    assert.equal(
      deriveAiScore([
        { name: 'Suggestive', confidence: 40 },
        { name: 'Violence', confidence: 72.4 },
      ]),
      72,
    );
  });

  it('builds flag labels from high-confidence scores', () => {
    assert.deepEqual(
      deriveFlags(
        [
          { name: 'Violence', confidence: 80 },
          { name: 'Suggestive', confidence: 20 },
        ],
        null,
      ),
      ['Violence'],
    );
    assert.deepEqual(deriveFlags([], 'Needs review'), ['Needs review']);
  });
});
