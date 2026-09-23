-- Production Supabase schema for the auth and age-verification tables.
-- The Next.js server connects with the database owner / service role, which
-- bypasses RLS. These policies close the table to anon and authenticated
-- clients so government IDs and password hashes are never readable from the browser.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL UNIQUE,
  email_encrypted TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  age_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified TIMESTAMPTZ,
  email_verification_hash TEXT,
  email_verification_expires TIMESTAMPTZ,
  document_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  encrypted_front_url TEXT NOT NULL,
  encrypted_back_url TEXT NOT NULL,
  encrypted_selfie_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_queue_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_verification_status_idx ON users (verification_status);
CREATE INDEX IF NOT EXISTS users_age_verified_idx ON users (age_verified);
CREATE INDEX IF NOT EXISTS verification_documents_user_id_idx ON verification_documents (user_id);
CREATE INDEX IF NOT EXISTS review_queue_items_user_id_idx ON review_queue_items (user_id);
CREATE INDEX IF NOT EXISTS review_queue_items_status_idx ON review_queue_items (status);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE verification_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE review_queue_items FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;
DROP POLICY IF EXISTS users_delete ON users;
CREATE POLICY users_select ON users FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY users_insert ON users FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY users_update ON users FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY users_delete ON users FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS verification_documents_select ON verification_documents;
DROP POLICY IF EXISTS verification_documents_insert ON verification_documents;
DROP POLICY IF EXISTS verification_documents_update ON verification_documents;
DROP POLICY IF EXISTS verification_documents_delete ON verification_documents;
CREATE POLICY verification_documents_select ON verification_documents FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY verification_documents_insert ON verification_documents FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY verification_documents_update ON verification_documents FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY verification_documents_delete ON verification_documents FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS review_queue_items_select ON review_queue_items;
DROP POLICY IF EXISTS review_queue_items_insert ON review_queue_items;
DROP POLICY IF EXISTS review_queue_items_update ON review_queue_items;
DROP POLICY IF EXISTS review_queue_items_delete ON review_queue_items;
CREATE POLICY review_queue_items_select ON review_queue_items FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY review_queue_items_insert ON review_queue_items FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY review_queue_items_update ON review_queue_items FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY review_queue_items_delete ON review_queue_items FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
DROP POLICY IF EXISTS audit_logs_update ON audit_logs;
DROP POLICY IF EXISTS audit_logs_delete ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY audit_logs_update ON audit_logs FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY audit_logs_delete ON audit_logs FOR DELETE TO anon, authenticated USING (false);
