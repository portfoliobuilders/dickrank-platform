import assert from "node:assert/strict";
import test from "node:test";
import { buildHealthReport } from "./health";

const readyEnv = {
  NODE_ENV: "test" as const,
  DATABASE_URL: "postgresql://localhost/dickrank",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  STRIPE_SECRET_KEY: "sk_test",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test",
  AWS_S3_BUCKET: "dickrank-media",
  AWS_REGION: "us-east-1",
  JWT_SECRET: "jwt",
  ENCRYPTION_KEY: "enc",
  REDIS_URL: "redis://localhost:6379",
};

test("health report is ready when required configuration is present", () => {
  const report = buildHealthReport(readyEnv, new Date("2026-09-23T00:00:00.000Z"), 12.4);
  assert.equal(report.status, "ok");
  assert.equal(report.ready, true);
  assert.equal(report.uptimeSeconds, 12);
  assert.equal(report.service, "dickrank");
  assert.equal(JSON.stringify(report).includes("sk_test"), false);
});

test("health report is degraded without the database", () => {
  const report = buildHealthReport({ ...readyEnv, DATABASE_URL: "  " });
  assert.equal(report.ready, false);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks.database, false);
});
