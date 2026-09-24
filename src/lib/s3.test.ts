import { afterEach, describe, expect, it } from "vitest";
import { publicObjectUrl } from "@/lib/s3";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("publicObjectUrl", () => {
  it("prefers CloudFront when set", () => {
    process.env.CLOUDFRONT_DOMAIN = "cdn.dickrank.online";
    process.env.AWS_S3_BUCKET = "ignored";
    expect(publicObjectUrl("content/u1/file.webp")).toBe(
      "https://cdn.dickrank.online/content/u1/file.webp",
    );
  });

  it("falls back to regional S3 URLs", () => {
    delete process.env.CLOUDFRONT_DOMAIN;
    delete process.env.AWS_S3_ENDPOINT;
    process.env.AWS_S3_BUCKET = "dickrank-media";
    process.env.AWS_REGION = "us-west-2";
    expect(publicObjectUrl("avatars/u1/x.webp")).toBe(
      "https://dickrank-media.s3.us-west-2.amazonaws.com/avatars/u1/x.webp",
    );
  });
});
