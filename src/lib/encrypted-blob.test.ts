import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { decryptBuffer, encryptBuffer, parseEncryptionKey } from "./encrypted-blob";

test("round-trips a backup payload", () => {
  const key = randomBytes(32);
  const plaintext = Buffer.from("pg_dump contents");
  const encrypted = encryptBuffer(plaintext, key);
  assert.equal(decryptBuffer(encrypted, key).toString("utf8"), "pg_dump contents");
});

test("rejects a short encryption key", () => {
  assert.throws(() => parseEncryptionKey("not-a-key"), /32 bytes/);
});

test("accepts a 32-byte base64 encryption key", () => {
  const key = randomBytes(32);
  assert.deepEqual(parseEncryptionKey(key.toString("base64")), key);
});
