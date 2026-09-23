import assert from "node:assert/strict";
import test from "node:test";
import { backupObjectKey, isExpiredBackup } from "./backup-db";
import { assertSafeTempDir, auditCutoff, isOrphanedObject, isStaleTempFile } from "./cleanup-temp";
import { parseDatabaseUrl, redactSecrets } from "./ops";

const now = new Date("2026-09-23T00:00:00.000Z");

test("backup keys stay inside the backup prefix and expire after 30 days", () => {
  const key = backupObjectKey(now);
  assert.match(key, /^backups\/postgres\/2026-09-23\/dickrank-/);
  const fresh = new Date("2026-09-01T00:00:00.000Z");
  const old = new Date("2026-08-23T00:00:00.000Z");
  assert.equal(isExpiredBackup(key, fresh, now, 30), false);
  assert.equal(isExpiredBackup(key, old, now, 30), true);
  assert.equal(isExpiredBackup("temp/file", old, now, 30), false);
});

test("only aged temp prefixes are orphaned", () => {
  const old = new Date("2026-09-21T00:00:00.000Z");
  const recent = new Date("2026-09-22T23:00:00.000Z");
  assert.equal(isOrphanedObject("temp/upload.bin", old, now, 24), true);
  assert.equal(isOrphanedObject("uploads/tmp/a.jpg", old, now, 24), true);
  assert.equal(isOrphanedObject("temp/upload.bin", recent, now, 24), false);
  assert.equal(isOrphanedObject("media/kept.jpg", old, now, 24), false);
});

test("temp file age and directory safety", () => {
  assert.equal(isStaleTempFile(now.getTime() - 25 * 60 * 60 * 1000, now, 24), true);
  assert.equal(isStaleTempFile(now.getTime() - 60 * 1000, now, 24), false);
  assert.throws(() => assertSafeTempDir("/"), /filesystem root/);
  assert.equal(auditCutoff(now, 90).toISOString(), "2026-06-25T00:00:00.000Z");
});

test("database URL parsing does not leak through redaction", () => {
  const parsed = parseDatabaseUrl("postgresql://user:p%40ss@db.example.com:6543/dickrank");
  assert.equal(parsed.user, "user");
  assert.equal(parsed.password, "p@ss");
  assert.equal(parsed.host, "db.example.com");
  assert.equal(parsed.port, "6543");
  assert.equal(parsed.database, "dickrank");
  assert.match(redactSecrets("failed postgresql://user:p%40ss@db.example.com/dickrank"), /\[redacted\]/);
});
