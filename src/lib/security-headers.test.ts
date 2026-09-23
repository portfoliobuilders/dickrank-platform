import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSecurityHeaders } from "./security-headers";

const require = createRequire(import.meta.url);

test("production security headers include the required policies", () => {
  const headers = getSecurityHeaders();
  const byKey = new Map(headers.map((header) => [header.key, header.value]));
  assert.match(byKey.get("Content-Security-Policy") ?? "", /default-src 'self'/);
  assert.match(byKey.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(byKey.get("X-Frame-Options"), "DENY");
  assert.equal(byKey.get("X-Content-Type-Options"), "nosniff");
  assert.equal(byKey.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(byKey.get("Permissions-Policy") ?? "", /camera=\(\)/);
  assert.match(byKey.get("Strict-Transport-Security") ?? "", /max-age=63072000/);
});

test("vercel.json and next.config.js apply the same security headers", async () => {
  const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const block = vercel.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(block);
  assert.deepEqual(block.headers, getSecurityHeaders());

  const nextConfig = require("../../next.config.js") as {
    headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>;
  };
  const applied = await nextConfig.headers();
  assert.equal(applied[0]?.source, "/(.*)");
  assert.deepEqual(applied[0]?.headers, getSecurityHeaders());
});
