import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, it } from "node:test";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  const key = match[1].trim();
  const value = match[2].trim().replace(/^"|"$/g, "");
  if (!process.env[key]) process.env[key] = value;
}

describe("register API", () => {
  it("creates a pending user without returning the password and rejects duplicates", async () => {
    const { POST } = await import("../src/app/api/auth/register/route");
    const email = `person-${Date.now()}@example.com`;
    const username = `user_${Date.now()}`;
    const body = {
      email,
      username,
      password: "correcthorse1",
      confirmPassword: "correcthorse1",
    };

    const created = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(created.status, 201);
    const payload = (await created.json()) as {
      user: { email: string; username: string; verificationStatus: string; ageVerified: boolean; password?: string; passwordHash?: string };
    };
    assert.equal(payload.user.email, email);
    assert.equal(payload.user.username, username);
    assert.equal(payload.user.verificationStatus, "PENDING");
    assert.equal(payload.user.ageVerified, false);
    assert.equal("password" in payload.user, false);
    assert.equal("passwordHash" in payload.user, false);
    assert.equal(JSON.stringify(payload).includes("correcthorse1"), false);

    const duplicate = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(duplicate.status, 409);

    const mailbox = path.join(process.cwd(), "storage", "dev-mailbox");
    const latest = readdirSync(mailbox)
      .filter((name) => name.includes(email.replace(/[^a-z0-9@._-]/gi, "_")))
      .sort()
      .at(-1);
    assert.ok(latest);
    const code = readFileSync(path.join(mailbox, latest), "utf8").match(/code: (\d{6})/)?.[1];
    assert.ok(code);

    const { POST: verifyEmail } = await import("../src/app/api/auth/verify-email/route");
    const verified = await verifyEmail(
      new Request("http://localhost/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      }),
    );
    assert.equal(verified.status, 200);

    const { prisma } = await import("../src/lib/prisma");
    const { decryptString, hashEmail } = await import("../src/lib/crypto");
    const row = await prisma.user.findUnique({ where: { emailHash: hashEmail(email) } });
    assert.ok(row);
    assert.equal(decryptString(row.emailEncrypted), email);
    assert.equal(row.emailEncrypted.includes(email), false);
    assert.match(row.passwordHash, /^\$2[aby]\$/);
    assert.equal(row.verificationStatus, "PENDING");
    assert.equal(row.ageVerified, false);
    assert.ok(row.emailVerified);
  });
});
