import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSecurityHeaders } from "./security-headers";

test("production security headers match vercel.json", () => {
  const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const deployed = new Map(vercel.headers[0]?.headers.map((header) => [header.key, header.value]));
  const expected = new Map(getSecurityHeaders().map((header) => [header.key, header.value]));

  assert.deepEqual(deployed, expected);
  assert.equal(deployed.get("X-Frame-Options"), "DENY");
  assert.equal(deployed.get("X-Content-Type-Options"), "nosniff");
  assert.equal(deployed.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(deployed.get("Permissions-Policy") ?? "", /camera=\(\)/);
  assert.match(deployed.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  assert.match(deployed.get("Strict-Transport-Security") ?? "", /max-age=63072000/);
});

test("development CSP allows eval and skips HSTS", () => {
  const headers = new Map(getSecurityHeaders({ development: true }).map((header) => [header.key, header.value]));
  assert.match(headers.get("Content-Security-Policy") ?? "", /unsafe-eval/);
  assert.equal(headers.has("Strict-Transport-Security"), false);
});
