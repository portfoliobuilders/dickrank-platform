-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'USER';

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED', 'MANUAL_REVIEW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable Content
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "mediaKey" TEXT;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "moderationScores" JSONB;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

DO $$ BEGIN
  ALTER TABLE "Content" ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Content_mediaKey_key" ON "Content"("mediaKey");
CREATE INDEX IF NOT EXISTS "Content_moderationStatus_idx" ON "Content"("moderationStatus");

-- CreateTable
CREATE TABLE IF NOT EXISTS "ManualReview" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ManualReview_status_idx" ON "ManualReview"("status");
CREATE INDEX IF NOT EXISTS "ManualReview_contentId_idx" ON "ManualReview"("contentId");

DO $$ BEGIN
  ALTER TABLE "ManualReview" ADD CONSTRAINT "ManualReview_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
