-- Audit logging, DMCA claims, and GDPR deletion support.
-- Row Level Security protects the Supabase Data API.
-- The Next.js server uses the database owner role and enforces the same
-- rules in application code (service role bypasses RLS).

create type user_role as enum ('USER', 'ADMIN');
create type audit_action as enum (
  'LOGIN',
  'LOGOUT',
  'UPLOAD',
  'DELETE',
  'REPORT',
  'PAYMENT',
  'SETTINGS_CHANGE'
);
create type dmca_status as enum (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'COUNTER_NOTIFIED',
  'RESTORED'
);
create type export_status as enum ('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');
create type notification_status as enum ('PENDING', 'SENT', 'FAILED');

create table users (
  id text primary key,
  email_encrypted text not null,
  email_hash text not null unique,
  display_name text,
  role user_role not null default 'USER',
  age_verified boolean not null default false,
  stripe_account_id text,
  anonymized_at timestamptz,
  suspended_at timestamptz,
  terminated_at timestamptz,
  deletion_requested_at timestamptz,
  deletion_execute_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_deletion_execute_at_idx on users (deletion_execute_at);
create index users_anonymized_at_idx on users (anonymized_at);

create table audit_logs (
  id text primary key,
  user_id text references users (id) on delete set null,
  action audit_action not null,
  resource text not null,
  details jsonb,
  ip_address_hash text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_logs_user_id_idx on audit_logs (user_id);
create index audit_logs_action_idx on audit_logs (action);
create index audit_logs_created_at_idx on audit_logs (created_at);

create table contents (
  id text primary key,
  owner_id text not null references users (id) on delete cascade,
  url text not null,
  title text,
  storage_key text,
  media_kind text,
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contents_owner_id_idx on contents (owner_id);
create index contents_url_idx on contents (url);
create index contents_hidden_idx on contents (hidden);

create table posts (
  id text primary key,
  author_id text not null references users (id) on delete cascade,
  body text not null,
  anonymized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_author_id_idx on posts (author_id);

create table dmca_claims (
  id text primary key,
  content_id text references contents (id) on delete set null,
  content_url text not null,
  description text not null,
  contact_info_encrypted text not null,
  signature boolean not null,
  status dmca_status not null default 'PENDING_REVIEW',
  claimant_user_id text references users (id) on delete set null,
  content_owner_id text references users (id) on delete set null,
  counter_statement text,
  counter_contact_encrypted text,
  counter_filed_at timestamptz,
  restore_at timestamptz,
  lawsuit_filed boolean not null default false,
  ip_address_hash text not null,
  reviewed_at timestamptz,
  reviewed_by_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dmca_claims_signature_check check (signature = true)
);

create index dmca_claims_status_idx on dmca_claims (status);
create index dmca_claims_content_owner_id_idx on dmca_claims (content_owner_id);
create index dmca_claims_claimant_user_id_idx on dmca_claims (claimant_user_id);
create index dmca_claims_restore_at_idx on dmca_claims (restore_at);
create index dmca_claims_ip_created_idx on dmca_claims (ip_address_hash, created_at);

create table data_export_jobs (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  status export_status not null default 'QUEUED',
  storage_key text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz
);

create index data_export_jobs_user_id_idx on data_export_jobs (user_id);
create index data_export_jobs_status_idx on data_export_jobs (status);

create table payment_records (
  id text primary key,
  user_id text references users (id) on delete set null,
  account_ref text not null,
  amount_cents integer not null,
  currency text not null,
  description text,
  retain_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_records_user_id_idx on payment_records (user_id);
create index payment_records_account_ref_idx on payment_records (account_ref);
create index payment_records_retain_until_idx on payment_records (retain_until);

create table notifications (
  id text primary key,
  user_id text references users (id) on delete set null,
  recipient_encrypted text not null,
  subject text not null,
  body text not null,
  status notification_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notifications_user_id_idx on notifications (user_id);
create index notifications_status_idx on notifications (status);

alter table users enable row level security;
alter table audit_logs enable row level security;
alter table contents enable row level security;
alter table posts enable row level security;
alter table dmca_claims enable row level security;
alter table data_export_jobs enable row level security;
alter table payment_records enable row level security;
alter table notifications enable row level security;

create or replace function is_age_verified_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from users
    where id = auth.uid()::text
      and role = 'ADMIN'
      and age_verified = true
      and anonymized_at is null
  );
$$;

-- users
create policy users_select_own on users
  for select to authenticated
  using (id = auth.uid()::text);

create policy users_select_admin on users
  for select to authenticated
  using (is_age_verified_admin());

create policy users_insert_own on users
  for insert to authenticated
  with check (id = auth.uid()::text and role = 'USER');

create policy users_update_own on users
  for update to authenticated
  using (id = auth.uid()::text and role = 'USER')
  with check (id = auth.uid()::text and role = 'USER');

create policy users_update_admin on users
  for update to authenticated
  using (is_age_verified_admin())
  with check (is_age_verified_admin());

create policy users_delete_admin on users
  for delete to authenticated
  using (is_age_verified_admin());

-- audit_logs: readable by the subject and by admins. Writes stay on the server.
create policy audit_logs_select_own on audit_logs
  for select to authenticated
  using (user_id = auth.uid()::text);

create policy audit_logs_select_admin on audit_logs
  for select to authenticated
  using (is_age_verified_admin());

create policy audit_logs_insert_none on audit_logs
  for insert to authenticated
  with check (false);

create policy audit_logs_update_none on audit_logs
  for update to authenticated
  using (false)
  with check (false);

create policy audit_logs_delete_none on audit_logs
  for delete to authenticated
  using (false);

-- contents: age-verified members see public rows. Admins can review hidden rows.
create policy contents_select_public on contents
  for select to authenticated
  using (
    hidden = false
    and exists (
      select 1 from users
      where id = auth.uid()::text
        and age_verified = true
        and anonymized_at is null
    )
  );

create policy contents_select_admin on contents
  for select to authenticated
  using (is_age_verified_admin());

create policy contents_insert_own on contents
  for insert to authenticated
  with check (
    owner_id = auth.uid()::text
    and exists (
      select 1 from users
      where id = auth.uid()::text
        and age_verified = true
        and anonymized_at is null
    )
  );

create policy contents_update_own on contents
  for update to authenticated
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

create policy contents_delete_own on contents
  for delete to authenticated
  using (owner_id = auth.uid()::text);

-- posts
create policy posts_select_own on posts
  for select to authenticated
  using (author_id = auth.uid()::text);

create policy posts_select_admin on posts
  for select to authenticated
  using (is_age_verified_admin());

create policy posts_insert_own on posts
  for insert to authenticated
  with check (
    author_id = auth.uid()::text
    and exists (
      select 1 from users
      where id = auth.uid()::text and age_verified = true and anonymized_at is null
    )
  );

create policy posts_update_own on posts
  for update to authenticated
  using (author_id = auth.uid()::text)
  with check (author_id = auth.uid()::text);

create policy posts_delete_own on posts
  for delete to authenticated
  using (author_id = auth.uid()::text);

-- dmca_claims
create policy dmca_claims_select_party on dmca_claims
  for select to authenticated
  using (
    claimant_user_id = auth.uid()::text
    or content_owner_id = auth.uid()::text
  );

create policy dmca_claims_select_admin on dmca_claims
  for select to authenticated
  using (is_age_verified_admin());

create policy dmca_claims_insert_none on dmca_claims
  for insert to authenticated
  with check (false);

create policy dmca_claims_update_none on dmca_claims
  for update to authenticated
  using (false)
  with check (false);

create policy dmca_claims_delete_none on dmca_claims
  for delete to authenticated
  using (false);

-- data exports: owner can see job status, not another person's archive
create policy data_export_jobs_select_own on data_export_jobs
  for select to authenticated
  using (user_id = auth.uid()::text);

create policy data_export_jobs_select_admin on data_export_jobs
  for select to authenticated
  using (is_age_verified_admin());

create policy data_export_jobs_insert_none on data_export_jobs
  for insert to authenticated
  with check (false);

create policy data_export_jobs_update_none on data_export_jobs
  for update to authenticated
  using (false)
  with check (false);

create policy data_export_jobs_delete_own on data_export_jobs
  for delete to authenticated
  using (user_id = auth.uid()::text);

-- payment records: the account holder and admins may read. No client writes.
create policy payment_records_select_own on payment_records
  for select to authenticated
  using (user_id = auth.uid()::text or account_ref = auth.uid()::text);

create policy payment_records_select_admin on payment_records
  for select to authenticated
  using (is_age_verified_admin());

create policy payment_records_insert_none on payment_records
  for insert to authenticated
  with check (false);

create policy payment_records_update_none on payment_records
  for update to authenticated
  using (false)
  with check (false);

create policy payment_records_delete_none on payment_records
  for delete to authenticated
  using (false);

-- notifications
create policy notifications_select_own on notifications
  for select to authenticated
  using (user_id = auth.uid()::text);

create policy notifications_select_admin on notifications
  for select to authenticated
  using (is_age_verified_admin());

create policy notifications_insert_none on notifications
  for insert to authenticated
  with check (false);

create policy notifications_update_own on notifications
  for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create policy notifications_delete_own on notifications
  for delete to authenticated
  using (user_id = auth.uid()::text);
