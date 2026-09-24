import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectImage } from '../lib/image-processing';

function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.write('PNG', 1, 'ascii');
  buffer[0] = 0x89;
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test('accepts a small PNG', () => {
  const result = inspectImage(png(800, 600));
  assert.deepEqual(result, { ok: true, kind: 'png', width: 800, height: 600 });
});

test('rejects an unknown file', () => {
  const result = inspectImage(Buffer.from('not-an-image'));
  assert.equal(result.ok, false);
});

test('rejects an oversized edge', () => {
  const result = inspectImage(png(9000, 10));
  assert.equal(result.ok, false);
});
