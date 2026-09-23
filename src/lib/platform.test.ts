import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { decryptJson, encryptJson } from "@/lib/encryption";
import { containsProhibitedContent } from "@/lib/safety";
import { createContentSchema, listContentQuerySchema } from "@/lib/validators";
import {
  demoGetContent,
  demoListContent,
  demoSoftDelete,
  demoToggleLike,
  demoViewer,
  resetDemoStore,
} from "@/lib/demo-store";

before(() => {
  process.env.ENCRYPTION_KEY = "test-key-test-key-test-key-test-key";
  resetDemoStore();
});

describe("preferences encryption", () => {
  it("round-trips preference objects", () => {
    const preferences = {
      privateAccount: true,
      notificationEmail: "member@example.com",
    };
    const ciphertext = encryptJson(preferences);
    assert.equal(ciphertext.includes("member@example.com"), false);
    assert.deepEqual(decryptJson<typeof preferences>(ciphertext), preferences);
  });

  it("rejects a tampered payload", () => {
    const ciphertext = encryptJson({ ok: true });
    const buffer = Buffer.from(ciphertext, "base64");
    buffer[buffer.length - 1] ^= 1;
    assert.throws(() => decryptJson(buffer.toString("base64")));
  });
});

describe("adult content safety", () => {
  it("blocks minor-related copy", () => {
    assert.equal(containsProhibitedContent("studio set"), false);
    assert.equal(containsProhibitedContent("features a minor"), true);
    assert.equal(containsProhibitedContent(["portrait", "underage"]), true);
  });
});

describe("content validation", () => {
  it("requires https media and accepts list filters", () => {
    assert.equal(
      createContentSchema.safeParse({
        title: "Set",
        category: "photos",
        mediaUrl: "http://example.com/a.jpg",
        mediaType: "image",
      }).success,
      false,
    );
    const query = listContentQuerySchema.parse({
      sort: "popular",
      page: "2",
      feed: "premium",
      tags: ["studio"],
    });
    assert.equal(query.page, 2);
    assert.equal(query.sort, "popular");
    assert.deepEqual(query.tags, ["studio"]);
  });
});

describe("demo content actions", () => {
  it("toggles likes and soft-deletes without dropping the row from the owner view", () => {
    resetDemoStore();
    const viewer = demoViewer();
    const creator = { ...viewer, id: "00000000-0000-4000-8000-000000000010" };
    const id = "22222222-2222-4222-8222-222222222222";
    const first = demoToggleLike(viewer.id, id);
    assert.equal(first.liked, false);
    const second = demoToggleLike(viewer.id, id);
    assert.equal(second.liked, true);
    assert.equal(second.likeCount, first.likeCount + 1);

    demoSoftDelete(creator, id);
    assert.equal(demoGetContent(id, creator.id)?.status, "DELETED");
    assert.equal(demoGetContent(id, viewer.id), null);
    assert.equal(
      demoListContent({ page: 1, sort: "newest" }).items.some((item) => item.id === id),
      false,
    );
  });
});
