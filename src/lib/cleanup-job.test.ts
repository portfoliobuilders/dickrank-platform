import assert from "node:assert/strict";
import test from "node:test";

import { deletableStorageKey, retentionCutoff, USER_GRACE_DAYS } from "./cleanup-job";

test("grace period is thirty days before the given moment", () => {
  const now = new Date("2026-09-24T00:00:00.000Z");
  assert.equal(retentionCutoff(now, USER_GRACE_DAYS).toISOString(), "2026-08-25T00:00:00.000Z");
});

test("only stored object keys can be deleted", () => {
  assert.equal(deletableStorageKey("uploads/user/file.jpg"), "uploads/user/file.jpg");
  assert.equal(deletableStorageKey(" archives/audit-logs/secret "), null);
  assert.equal(deletableStorageKey("backups/db.sql"), null);
  assert.equal(deletableStorageKey("../backups/db.sql"), null);
  assert.equal(deletableStorageKey("/etc/passwd"), null);
  assert.equal(deletableStorageKey("uploads//file.jpg"), null);
  assert.equal(deletableStorageKey(null), null);
});
