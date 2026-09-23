-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "ageVerification" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "healthVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedPartnerCount" INTEGER NOT NULL DEFAULT 0,
    "activityPoints" INTEGER NOT NULL DEFAULT 0,
    "communityEngagement" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "feel" DOUBLE PRECISION NOT NULL,
    "performance" DOUBLE PRECISION NOT NULL,
    "experience" DOUBLE PRECISION NOT NULL,
    "userExperience" DOUBLE PRECISION NOT NULL,
    "weightedScore" DOUBLE PRECISION NOT NULL,
    "pros" TEXT NOT NULL DEFAULT '',
    "cons" TEXT NOT NULL DEFAULT '',
    "review" TEXT NOT NULL DEFAULT '',
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "previousRank" INTEGER,
    "cronInitialized" BOOLEAN NOT NULL DEFAULT false,
    "trend" TEXT NOT NULL DEFAULT 'same',
    "stats" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_verified_ageVerification_idx" ON "User"("verified", "ageVerification");
CREATE INDEX "Content_creatorId_idx" ON "Content"("creatorId");
CREATE INDEX "Content_type_idx" ON "Content"("type");
CREATE INDEX "Content_category_idx" ON "Content"("category");
CREATE INDEX "Content_ratingAverage_idx" ON "Content"("ratingAverage");
CREATE INDEX "Rating_contentId_createdAt_idx" ON "Rating"("contentId", "createdAt");
CREATE INDEX "Rating_userId_idx" ON "Rating"("userId");
CREATE UNIQUE INDEX "Rating_contentId_userId_key" ON "Rating"("contentId", "userId");
CREATE INDEX "LeaderboardEntry_category_period_score_idx" ON "LeaderboardEntry"("category", "period", "score");
CREATE INDEX "LeaderboardEntry_category_period_rank_idx" ON "LeaderboardEntry"("category", "period", "rank");
CREATE UNIQUE INDEX "LeaderboardEntry_userId_category_period_key" ON "LeaderboardEntry"("userId", "category", "period");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Range checks keep scores on the 1-10 review scale.
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_overall_range" CHECK ("overall" >= 1 AND "overall" <= 10);
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_feel_range" CHECK ("feel" >= 1 AND "feel" <= 10);
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_performance_range" CHECK ("performance" >= 1 AND "performance" <= 10);
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_experience_range" CHECK ("experience" >= 1 AND "experience" <= 10);
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userExperience_range" CHECK ("userExperience" >= 1 AND "userExperience" <= 10);

-- Supabase already has these roles. Local Postgres does not.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- Supabase provides auth.uid(). Local Postgres does not, so create a stub only when it is missing.
-- Do not replace the real Supabase function.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $fn$ SELECT NULL::uuid $fn$;
  END IF;
END $$;

-- Row level security. The API connects as the database owner and bypasses these policies.
-- Direct Supabase access from the browser is limited to the policies below.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rating" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaderboardEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Public profile fields used by the leaderboard. Contact details are not stored here.
CREATE POLICY "user_select_public" ON "User" FOR SELECT USING (true);
CREATE POLICY "user_insert_own" ON "User" FOR INSERT WITH CHECK (auth.uid()::text = "id");
CREATE POLICY "user_update_own_safe" ON "User" FOR UPDATE
  USING (auth.uid()::text = "id")
  WITH CHECK (auth.uid()::text = "id");
CREATE POLICY "user_delete_own" ON "User" FOR DELETE USING (auth.uid()::text = "id");

CREATE POLICY "content_select_public" ON "Content" FOR SELECT USING (true);
CREATE POLICY "content_insert_own_verified" ON "Content" FOR INSERT
  WITH CHECK (
    auth.uid()::text = "creatorId"
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.uid()::text
        AND u."ageVerification" = true
        AND u.verified = true
    )
  );
CREATE POLICY "content_update_own" ON "Content" FOR UPDATE
  USING (auth.uid()::text = "creatorId")
  WITH CHECK (auth.uid()::text = "creatorId");
CREATE POLICY "content_delete_own" ON "Content" FOR DELETE USING (auth.uid()::text = "creatorId");

-- Anyone can read reviews. Anonymous rows stay visible, but the rater id is not granted to browser roles.
CREATE POLICY "rating_select_public" ON "Rating" FOR SELECT USING (true);
CREATE POLICY "rating_insert_verified_not_own" ON "Rating" FOR INSERT
  WITH CHECK (
    auth.uid()::text = "userId"
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.uid()::text
        AND u."ageVerification" = true
        AND u.verified = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM "Content" c
      WHERE c.id = "contentId"
        AND c."creatorId" = auth.uid()::text
    )
  );
CREATE POLICY "rating_update_own" ON "Rating" FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "rating_delete_own" ON "Rating" FOR DELETE USING (auth.uid()::text = "userId");

CREATE POLICY "leaderboard_select_public" ON "LeaderboardEntry" FOR SELECT USING (true);
CREATE POLICY "leaderboard_insert_server_only" ON "LeaderboardEntry" FOR INSERT WITH CHECK (false);
CREATE POLICY "leaderboard_update_server_only" ON "LeaderboardEntry" FOR UPDATE USING (false);
CREATE POLICY "leaderboard_delete_server_only" ON "LeaderboardEntry" FOR DELETE USING (false);

CREATE POLICY "notification_select_own" ON "Notification" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "notification_insert_server_only" ON "Notification" FOR INSERT WITH CHECK (false);
CREATE POLICY "notification_update_own_read" ON "Notification" FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "notification_delete_own" ON "Notification" FOR DELETE USING (auth.uid()::text = "userId");

CREATE POLICY "audit_select_none" ON "AuditLog" FOR SELECT USING (false);
CREATE POLICY "audit_insert_none" ON "AuditLog" FOR INSERT WITH CHECK (false);
CREATE POLICY "audit_update_none" ON "AuditLog" FOR UPDATE USING (false);
CREATE POLICY "audit_delete_none" ON "AuditLog" FOR DELETE USING (false);

-- Browser roles can read public boards and reviews. Writes go through the API,
-- which uses the database owner role. Verification flags are not client-writable.
GRANT SELECT ("id", "username", "avatarUrl") ON "User" TO anon, authenticated;
GRANT UPDATE ("username", "avatarUrl") ON "User" TO authenticated;
GRANT SELECT ON "Content" TO anon, authenticated;
GRANT SELECT (
  "id", "contentId", "overall", "feel", "performance", "experience", "userExperience",
  "weightedScore", "pros", "cons", "review", "anonymous", "createdAt", "updatedAt"
) ON "Rating" TO anon, authenticated;
GRANT SELECT ON "LeaderboardEntry" TO anon, authenticated;
GRANT SELECT, UPDATE ("read") ON "Notification" TO authenticated;
