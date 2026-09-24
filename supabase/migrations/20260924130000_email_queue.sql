-- Outbound email queue. Service-role only; recipient PII is encrypted by the app.

create table if not exists public.email_queue (
  id text primary key,
  "toEncrypted" text not null,
  subject text not null,
  html text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  "sentAt" timestamptz,
  error text,
  "retryCount" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists email_queue_status_created_at_idx
  on public.email_queue (status, "createdAt");

alter table public.email_queue enable row level security;

create policy email_queue_select_none on public.email_queue
  for select to authenticated using (false);
create policy email_queue_insert_none on public.email_queue
  for insert to authenticated with check (false);
create policy email_queue_update_none on public.email_queue
  for update to authenticated using (false);
create policy email_queue_delete_none on public.email_queue
  for delete to authenticated using (false);
