import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHealth } from "../../../lib/health";

test("reports ok when the database check is skipped or healthy", () => {
  const skipped = evaluateHealth({ database: "skipped" }, new Date("2026-01-01T00:00:00.000Z"), "0.1.0");
  assert.equal(skipped.status, "ok");
  assert.equal(skipped.version, "0.1.0");
  assert.equal(skipped.checks.database, "skipped");

  const healthy = evaluateHealth({ database: "ok" }, new Date("2026-01-01T00:00:00.000Z"), "0.1.0");
  assert.equal(healthy.status, "ok");
});

test("reports degraded when the database check fails", () => {
  const degraded = evaluateHealth({ database: "error" }, new Date("2026-01-01T00:00:00.000Z"), "0.1.0");
  assert.equal(degraded.status, "degraded");
  assert.equal(degraded.checks.database, "error");
});
