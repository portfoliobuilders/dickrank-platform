-- Compliance tables for DMCA claims, data export, retained payments, and email outbox.
-- This does not recreate users, content, or the existing audit log.
-- Those shared tables already exist from earlier migrations and still disagree
-- across Prisma and SQL in this repo. Add the privacy columns there with Prisma
-- before relying on account deletion.

create table if not exists posts (
  id text primary key,
  author_id text not null,
  body text not null,
  anonymized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dmca_claims (
  id text primary key,
  content_id text,
  content_url text not null,
  description text not null,
  contact_info_encrypted text not null,
  signature boolean not null,
  status text not null default 'PENDING_REVIEW',
  claimant_user_id text,
  content_owner_id text,
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

create table if not exists data_export_jobs (
  id text primary key,
  user_id text not null,
  status text not null default 'QUEUED',
  storage_key text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz
);

create table if not exists payment_records (
  id text primary key,
  user_id text,
  account_ref text not null,
  amount_cents integer not null,
  currency text not null,
  description text,
  retain_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_outbox (
  id text primary key,
  user_id text,
  recipient_encrypted text not null,
  subject text not null,
  body text not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table posts enable row level security;
alter table dmca_claims enable row level security;
alter table data_export_jobs enable row level security;
alter table payment_records enable row level security;
alter table email_outbox enable row level security;

-- No policies for anon/authenticated. The Next.js server uses the database owner role.
create policy posts_select_none on posts for select to authenticated using (false);
create policy posts_insert_none on posts for insert to authenticated with check (false);
create policy posts_update_none on posts for update to authenticated using (false) with check (false);
create policy posts_delete_none on posts for delete to authenticated using (false);

create policy dmca_claims_select_none on dmca_claims for select to authenticated using (false);
create policy dmca_claims_insert_none on dmca_claims for insert to authenticated with check (false);
create policy dmca_claims_update_none on dmca_claims for update to authenticated using (false) with check (false);
create policy dmca_claims_delete_none on dmca_claims for delete to authenticated using (false);

create policy data_export_jobs_select_none on data_export_jobs for select to authenticated using (false);
create policy data_export_jobs_insert_none on data_export_jobs for insert to authenticated with check (false);
create policy data_export_jobs_update_none on data_export_jobs for update to authenticated using (false) with check (false);
create policy data_export_jobs_delete_none on data_export_jobs for delete to authenticated using (false);

create policy payment_records_select_none on payment_records for select to authenticated using (false);
create policy payment_records_insert_none on payment_records for insert to authenticated with check (false);
create policy payment_records_update_none on payment_records for update to authenticated using (false) with check (false);
create policy payment_records_delete_none on payment_records for delete to authenticated using (false);

create policy email_outbox_select_none on email_outbox for select to authenticated using (false);
create policy email_outbox_insert_none on email_outbox for insert to authenticated with check (false);
create policy email_outbox_update_none on email_outbox for update to authenticated using (false) with check (false);
create policy email_outbox_delete_none on email_outbox for delete to authenticated using (false);
