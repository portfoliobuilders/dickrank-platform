-- Content upload tables and row level security.
-- The Next.js server uses the database role for inserts after it has
-- checked age verification. These policies cover direct Supabase access.

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "ageVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "content" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
  "mediaKey" TEXT NOT NULL UNIQUE,
  "mediaUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "contentType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "moderationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "moderationJobId" TEXT,
  "faceJobId" TEXT,
  "moderationScores" JSONB,
  "rejectionReason" TEXT,
  "virusScanStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "content_userId_idx" ON "content" ("userId");
CREATE INDEX IF NOT EXISTS "content_moderationStatus_idx" ON "content" ("moderationStatus");
CREATE INDEX IF NOT EXISTS "content_category_idx" ON "content" ("category");
CREATE INDEX IF NOT EXISTS "content_moderationJobId_idx" ON "content" ("moderationJobId");
CREATE INDEX IF NOT EXISTS "content_faceJobId_idx" ON "content" ("faceJobId");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "audit_log_userId_idx" ON "audit_log" ("userId");
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log" ("action");
CREATE INDEX IF NOT EXISTS "audit_log_createdAt_idx" ON "audit_log" ("createdAt");

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

CREATE TABLE IF NOT EXISTS "notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "notification_userId_read_idx" ON "notification" ("userId", "read");

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manual_review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON "users"
  FOR SELECT USING (auth.uid()::text = "id");

CREATE POLICY "users_update_own" ON "users"
  FOR UPDATE USING (auth.uid()::text = "id")
  WITH CHECK (auth.uid()::text = "id");

CREATE POLICY "content_select_visible" ON "content"
  FOR SELECT USING (
    (privacy = 'PUBLIC' AND "moderationStatus" = 'APPROVED')
    OR auth.uid()::text = "userId"
  );

CREATE POLICY "content_insert_own" ON "content"
  FOR INSERT WITH CHECK (
    auth.uid()::text = "userId"
    AND "moderationStatus" = 'PENDING'
    AND EXISTS (
      SELECT 1 FROM "users" u
      WHERE u."id" = auth.uid()::text AND u."ageVerified" = TRUE
    )
  );

CREATE OR REPLACE FUNCTION prevent_creator_moderation_edits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW."moderationStatus" := OLD."moderationStatus";
    NEW."virusScanStatus" := OLD."virusScanStatus";
    NEW."moderationScores" := OLD."moderationScores";
    NEW."rejectionReason" := OLD."rejectionReason";
    NEW."moderationJobId" := OLD."moderationJobId";
    NEW."faceJobId" := OLD."faceJobId";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_lock_moderation ON "content";
CREATE TRIGGER content_lock_moderation
  BEFORE UPDATE ON "content"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_creator_moderation_edits();

CREATE POLICY "content_update_own" ON "content"
  FOR UPDATE USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "content_delete_own" ON "content"
  FOR DELETE USING (auth.uid()::text = "userId");

CREATE POLICY "audit_log_select_own" ON "audit_log"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "notification_select_own" ON "notification"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "notification_update_own" ON "notification"
  FOR UPDATE USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "manual_review_select_own" ON "manual_review"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "content" c
      WHERE c."id" = "contentId" AND c."userId" = auth.uid()::text
    )
  );
