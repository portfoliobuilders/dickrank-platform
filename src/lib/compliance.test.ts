import assert from "node:assert/strict";
import test from "node:test";
import { decryptPii, encryptPii, formatHashedIp, hashIp, sanitizeDetails } from "./crypto";
import { toCsv } from "./csv";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  DMCA_RESTORE_DELAY_DAYS,
  FINANCIAL_RECORD_RETENTION_YEARS,
  LOG_RETENTION_AFTER_DELETION_YEARS,
  addDays,
  addYears,
  deletionExecuteAt,
  dmcaRestoreAt,
  financialRetainUntil,
  logsPurgeAt,
} from "./retention";
import { deleteAccountSchema, dmcaClaimSchema, dmcaCounterSchema } from "./schemas";
import { parseUserAgent } from "./user-agent";

process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.IP_HASH_SALT = "test-salt";

test("encrypts contact details so they are not stored in plaintext", () => {
  const encrypted = encryptPii("ada@example.com, 1 Main St");
  assert.equal(encrypted.includes("ada@example.com"), false);
  assert.equal(decryptPii(encrypted), "ada@example.com, 1 Main St");
});

test("hashes IP addresses one way and keeps the hash stable", () => {
  const first = hashIp("203.0.113.10");
  const second = hashIp("203.0.113.10");
  assert.equal(first, second);
  assert.equal(first.includes("203.0.113.10"), false);
  assert.match(formatHashedIp(first), /^[0-9a-f]{8}…[0-9a-f]{4}$/);
});

test("drops secrets from audit details", () => {
  const clean = sanitizeDetails({
    event: "login",
    email: "ada@example.com",
    contactInfo: "secret",
    ipAddress: "203.0.113.10",
    count: 2,
  });
  assert.deepEqual(clean, { event: "login", count: 2 });
});

test("parses a browser user agent into browser, OS, and device", () => {
  const parsed = parseUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );
  assert.equal(parsed.browser, "Chrome");
  assert.equal(parsed.os, "Windows");
  assert.equal(parsed.device, "desktop");
});

test("neutralizes spreadsheet formulas in CSV cells", () => {
  const csv = toCsv(["resource"], [["=cmd()"]]);
  assert.match(csv, /"'=cmd\(\)"/);
});

test("retention clocks match the published policy", () => {
  const start = new Date("2026-01-15T00:00:00.000Z");
  assert.equal(deletionExecuteAt(start).toISOString(), addDays(start, ACCOUNT_DELETION_GRACE_DAYS).toISOString());
  assert.equal(dmcaRestoreAt(start).toISOString(), addDays(start, DMCA_RESTORE_DELAY_DAYS).toISOString());
  assert.equal(financialRetainUntil(start).toISOString(), addYears(start, FINANCIAL_RECORD_RETENTION_YEARS).toISOString());
  assert.equal(logsPurgeAt(start).toISOString(), addYears(start, LOG_RETENTION_AFTER_DELETION_YEARS).toISOString());
  assert.equal(FINANCIAL_RECORD_RETENTION_YEARS, 7);
  assert.equal(LOG_RETENTION_AFTER_DELETION_YEARS, 1);
  assert.equal(ACCOUNT_DELETION_GRACE_DAYS, 30);
  assert.equal(DMCA_RESTORE_DELAY_DAYS, 10);
});

test("DMCA claim requires the perjury checkbox", () => {
  assert.equal(dmcaClaimSchema.safeParse({
    contentUrl: "https://dickrank.online/post/1",
    description: "This is my copyrighted video from 2024.",
    contactInfo: "Ada Lovelace, ada@example.com",
    signature: "on",
  }).success, true);

  assert.equal(dmcaClaimSchema.safeParse({
    contentUrl: "https://dickrank.online/post/1",
    description: "This is my copyrighted video from 2024.",
    contactInfo: "Ada Lovelace, ada@example.com",
  }).success, false);
});

test("account deletion requires the word DELETE or CANCEL", () => {
  assert.equal(deleteAccountSchema.safeParse({ confirmation: "DELETE" }).success, true);
  assert.equal(deleteAccountSchema.safeParse({ confirmation: "delete" }).success, false);
});

test("counter-notice requires a claim id, statement, and contact info", () => {
  const parsed = dmcaCounterSchema.parse({
    claimId: "claim_1",
    statement: "I am the owner and this removal was a mistake.",
    contactInfo: "Ada Lovelace, ada@example.com, 1 Main St",
  });
  assert.equal(parsed.claimId, "claim_1");
});
