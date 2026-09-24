-- Admin moderation queue fields. Staff write via the service role (API routes).

ALTER TABLE IF EXISTS "content"
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaKey" TEXT,
  ADD COLUMN IF NOT EXISTS "moderationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "moderationScores" JSONB,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "content_mediaKey_key" ON "content" ("mediaKey") WHERE "mediaKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "content_moderationStatus_idx" ON "content" ("moderationStatus");

ALTER TABLE IF EXISTS "users"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "emailEncrypted" TEXT;

CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");

CREATE TABLE IF NOT EXISTS "manual_review" (
  "id" TEXT PRIMARY KEY,
  "contentId" TEXT NOT NULL REFERENCES "content"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "manual_review_status_idx" ON "manual_review" ("status");
CREATE INDEX IF NOT EXISTS "manual_review_contentId_idx" ON "manual_review" ("contentId");

ALTER TABLE "manual_review" ENABLE ROW LEVEL SECURITY;
