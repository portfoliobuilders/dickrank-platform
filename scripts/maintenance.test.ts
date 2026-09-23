import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BACKUP_RETENTION_DAYS, isOlderThanDays, retentionDaysFromEnv } from "./backup-db";
import { classifyStorageObject } from "./cleanup-temp";

const hour = 60 * 60 * 1000;

test("keeps 30 days of backups and deletes older ones", () => {
  const now = new Date("2026-03-31T00:00:00.000Z");
  const withinWindow = new Date(now.getTime() - 29 * 24 * hour);
  const expired = new Date(now.getTime() - 31 * 24 * hour);
  assert.equal(DEFAULT_BACKUP_RETENTION_DAYS, 30);
  assert.equal(isOlderThanDays(withinWindow, now, 30), false);
  assert.equal(isOlderThanDays(expired, now, 30), true);
  assert.equal(retentionDaysFromEnv(undefined), 30);
});

test("classifies temp objects, orphans, and protected backups", () => {
  const base = { tempMaxAgeHours: 24, orphanMinAgeHours: 48 };
  assert.equal(
    classifyStorageObject({ ...base, key: "temp/upload.bin", ageHours: 25, referenced: false }),
    "delete-temp",
  );
  assert.equal(
    classifyStorageObject({ ...base, key: "temp/upload.bin", ageHours: 2, referenced: false }),
    "keep",
  );
  assert.equal(
    classifyStorageObject({ ...base, key: "uploads/photo.jpg", ageHours: 72, referenced: false }),
    "delete-orphan",
  );
  assert.equal(
    classifyStorageObject({ ...base, key: "uploads/photo.jpg", ageHours: 72, referenced: true }),
    "keep",
  );
  assert.equal(
    classifyStorageObject({ ...base, key: "backups/database/dump.enc", ageHours: 1000, referenced: false }),
    "keep",
  );
});
