import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.AUTH_ENCRYPTION_KEY = "test-encryption-key-value";
process.env.NEXTAUTH_SECRET = "test-nextauth-secret-value";

describe("pii encryption", () => {
  it("round-trips an email and rejects tampering", async () => {
    const { decryptString, encryptString, hashEmail } = await import("../src/lib/crypto");
    const encrypted = encryptString("person@example.com");
    assert.equal(encrypted.includes("person@example.com"), false);
    assert.equal(decryptString(encrypted), "person@example.com");
    assert.notEqual(hashEmail("Person@Example.com"), hashEmail("other@example.com"));
    assert.equal(hashEmail("Person@Example.com"), hashEmail("person@example.com"));

    const [iv, tag, data] = encrypted.split(".");
    const flipped = data.slice(0, -1) + (data.endsWith("a") ? "b" : "a");
    assert.throws(() => decryptString(`${iv}.${tag}.${flipped}`));
  });

  it("compares verification codes without accepting a different code", async () => {
    const { generateNumericCode, hashVerificationCode, verificationCodesMatch } = await import("../src/lib/crypto");
    const code = generateNumericCode();
    assert.match(code, /^\d{6}$/);
    const hash = hashVerificationCode(code);
    assert.equal(verificationCodesMatch(code, hash), true);
    assert.equal(verificationCodesMatch("000000", hash), false);
  });
});

describe("registration schema", () => {
  it("rejects weak passwords and mismatched confirmation", async () => {
    const { registerSchema } = await import("../src/lib/schemas");
    const invalid = registerSchema.safeParse({
      email: "not-an-email",
      username: "ab",
      password: "short",
      confirmPassword: "different",
    });
    assert.equal(invalid.success, false);

    const valid = registerSchema.safeParse({
      email: "person@example.com",
      username: "Player_1",
      password: "correcthorse1",
      confirmPassword: "correcthorse1",
    });
    assert.equal(valid.success, true);
    if (valid.success) assert.equal(valid.data.username, "player_1");
  });
});

describe("id image checks", () => {
  it("rejects a missing file and a non-image upload", async () => {
    const { DocumentValidationError, readIdImage } = await import("../src/lib/documents");
    await assert.rejects(() => readIdImage(null, "Front of ID"), DocumentValidationError);
    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    await assert.rejects(() => readIdImage(textFile, "Front of ID"), /JPEG, PNG, or WebP/);
  });
});

describe("age gate paths", () => {
  it("sends unverified members to age verification and keeps public pages open", async () => {
    const { getPostLoginPath, isProtectedPath, isPublicPath } = await import("../src/lib/age-gate");
    assert.equal(getPostLoginPath(false, "/dashboard"), "/verify-age");
    assert.equal(getPostLoginPath(true, "/creator/studio"), "/creator/studio");
    assert.equal(isProtectedPath("/upload"), true);
    assert.equal(isProtectedPath("/creator/studio"), true);
    assert.equal(isPublicPath("/"), true);
    assert.equal(isPublicPath("/explore"), true);
    assert.equal(isPublicPath("/login"), true);
    assert.equal(isPublicPath("/register"), true);
    assert.equal(isProtectedPath("/explore"), false);
  });
});
