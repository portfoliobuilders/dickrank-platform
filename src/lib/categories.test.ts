import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ContentCategory } from "@prisma/client";
import { CATEGORY_VALUES, CONTENT_CATEGORIES } from "./categories";

describe("content categories", () => {
  it("lists the 26 schema categories", () => {
    assert.equal(CONTENT_CATEGORIES.length, 26);
    assert.deepEqual(
      [...CATEGORY_VALUES].sort(),
      Object.values(ContentCategory).sort(),
    );
  });
});
