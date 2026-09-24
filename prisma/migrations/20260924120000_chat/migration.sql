-- Real-time member chat. The API connects as the database owner and bypasses these policies.
-- Direct Supabase access from the browser cannot write messages.

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "directKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $fn$ SELECT NULL::uuid $fn$;
  END IF;
END $$;

ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_select_member" ON "Conversation" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ConversationMember" member
      WHERE member."conversationId" = "Conversation"."id"
        AND member."userId" = auth.uid()::text
    )
  );
CREATE POLICY "conversation_insert_server_only" ON "Conversation" FOR INSERT WITH CHECK (false);
CREATE POLICY "conversation_update_server_only" ON "Conversation" FOR UPDATE USING (false);
CREATE POLICY "conversation_delete_server_only" ON "Conversation" FOR DELETE USING (false);

CREATE POLICY "conversation_member_select_own" ON "ConversationMember" FOR SELECT
  USING (auth.uid()::text = "userId");
CREATE POLICY "conversation_member_insert_server_only" ON "ConversationMember" FOR INSERT WITH CHECK (false);
CREATE POLICY "conversation_member_update_server_only" ON "ConversationMember" FOR UPDATE USING (false);
CREATE POLICY "conversation_member_delete_server_only" ON "ConversationMember" FOR DELETE USING (false);

CREATE POLICY "message_select_member" ON "Message" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ConversationMember" member
      WHERE member."conversationId" = "Message"."conversationId"
        AND member."userId" = auth.uid()::text
    )
  );
CREATE POLICY "message_insert_server_only" ON "Message" FOR INSERT WITH CHECK (false);
CREATE POLICY "message_update_server_only" ON "Message" FOR UPDATE USING (false);
CREATE POLICY "message_delete_server_only" ON "Message" FOR DELETE USING (false);
