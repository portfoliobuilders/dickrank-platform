-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deleteRequestedAt" TIMESTAMP(3);
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_deleteRequestedAt_idx" ON "User"("deleteRequestedAt");
CREATE INDEX IF NOT EXISTS "Content_deletedAt_idx" ON "Content"("deletedAt");
