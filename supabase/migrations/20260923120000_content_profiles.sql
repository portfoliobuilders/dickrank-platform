-- Content, profiles, likes, follows, subscriptions, reports, and audit logs.
-- Row level security is enabled on every table.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  bio text,
  location text,
  orientation text,
  interests text[] not null default '{}',
  avatar_url text,
  is_creator boolean not null default false,
  is_verified boolean not null default false,
  age_verification boolean not null default false,
  content_count integer not null default 0,
  follower_count integer not null default 0,
  preferences_enc text,
  schedule jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_username_idx on public.users (username);
create index if not exists users_is_creator_idx on public.users (is_creator);

create table if not exists public.content (
  id text primary key default gen_random_uuid()::text,
  creator_id text not null references public.users (id) on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  category text,
  media_url text not null,
  thumbnail_url text,
  media_type text not null check (media_type in ('IMAGE', 'VIDEO')),
  qualities jsonb,
  is_premium boolean not null default false,
  status text not null default 'PUBLISHED' check (status in ('DRAFT', 'PUBLISHED', 'DELETED')),
  like_count integer not null default 0,
  view_count integer not null default 0,
  rating double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_creator_idx on public.content (creator_id);
create index if not exists content_category_idx on public.content (category);
create index if not exists content_status_created_idx on public.content (status, created_at desc);
create index if not exists content_premium_idx on public.content (is_premium);
create index if not exists content_tags_gin on public.content using gin (tags);

create table if not exists public.likes (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users (id) on delete cascade,
  content_id text not null references public.content (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, content_id)
);

create index if not exists likes_content_idx on public.likes (content_id);

create table if not exists public.follows (
  id text primary key default gen_random_uuid()::text,
  follower_id text not null references public.users (id) on delete cascade,
  following_id text not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

create table if not exists public.subscriptions (
  id text primary key default gen_random_uuid()::text,
  subscriber_id text not null references public.users (id) on delete cascade,
  creator_id text not null references public.users (id) on delete cascade,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscriber_id, creator_id)
);

create index if not exists subscriptions_creator_idx on public.subscriptions (creator_id);

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  user_id text references public.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_entity_idx on public.audit_logs (entity, entity_id);
create index if not exists audit_user_idx on public.audit_logs (user_id);

create table if not exists public.reports (
  id text primary key default gen_random_uuid()::text,
  reporter_id text references public.users (id) on delete set null,
  content_id text not null references public.content (id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  unique (reporter_id, content_id)
);

create index if not exists reports_content_idx on public.reports (content_id);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists content_set_updated_at on public.content;
create trigger content_set_updated_at before update on public.content
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_user_id, username, age_verification)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)),
    false
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.users enable row level security;
alter table public.content enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.reports enable row level security;

-- Encrypted preferences stay on the service role. Member clients cannot select them.
revoke all on table public.users from anon, authenticated;
grant select (
  id, auth_user_id, username, display_name, bio, location, orientation, interests,
  avatar_url, is_creator, is_verified, age_verification, content_count, follower_count,
  schedule, created_at, updated_at
) on public.users to anon, authenticated;
grant update (
  display_name, bio, location, orientation, interests, avatar_url, schedule, updated_at
) on public.users to authenticated;

grant select, insert, update, delete on public.content to anon, authenticated;
grant select, insert, update, delete on public.likes to authenticated;
grant select on public.likes to anon;
grant select, insert, update, delete on public.follows to authenticated;
grant select on public.follows to anon;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select on public.subscriptions to anon;
grant select, insert on public.reports to authenticated;
grant select, insert on public.audit_logs to authenticated;

grant all on table public.users to service_role;
grant all on table public.content to service_role;
grant all on table public.likes to service_role;
grant all on table public.follows to service_role;
grant all on table public.subscriptions to service_role;
grant all on table public.audit_logs to service_role;
grant all on table public.reports to service_role;

create policy users_select on public.users
  for select using (true);

create policy users_insert on public.users
  for insert with check (auth.uid() = auth_user_id);

create policy users_update on public.users
  for update using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy users_delete on public.users
  for delete using (auth.uid() = auth_user_id);

create policy content_select on public.content
  for select using (
    status = 'PUBLISHED'
    or creator_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy content_insert on public.content
  for insert with check (
    creator_id in (
      select id from public.users
      where auth_user_id = auth.uid() and age_verification = true
    )
  );

create policy content_update on public.content
  for update using (
    creator_id in (select id from public.users where auth_user_id = auth.uid())
  )
  with check (
    creator_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy content_delete on public.content
  for delete using (
    creator_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy likes_select on public.likes
  for select using (true);

create policy likes_insert on public.likes
  for insert with check (
    user_id in (
      select id from public.users
      where auth_user_id = auth.uid() and age_verification = true
    )
  );

create policy likes_update on public.likes
  for update using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy likes_delete on public.likes
  for delete using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy follows_select on public.follows
  for select using (true);

create policy follows_insert on public.follows
  for insert with check (
    follower_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy follows_update on public.follows
  for update using (
    follower_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy follows_delete on public.follows
  for delete using (
    follower_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy subscriptions_select on public.subscriptions
  for select using (true);

create policy subscriptions_insert on public.subscriptions
  for insert with check (
    subscriber_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy subscriptions_update on public.subscriptions
  for update using (
    subscriber_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy subscriptions_delete on public.subscriptions
  for delete using (
    subscriber_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy reports_select on public.reports
  for select using (
    reporter_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy reports_insert on public.reports
  for insert with check (
    reporter_id in (
      select id from public.users
      where auth_user_id = auth.uid() and age_verification = true
    )
  );

create policy reports_update on public.reports
  for update using (false);

create policy reports_delete on public.reports
  for delete using (
    reporter_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy audit_select on public.audit_logs
  for select using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy audit_insert on public.audit_logs
  for insert with check (
    user_id is null
    or user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy audit_update on public.audit_logs
  for update using (false);

create policy audit_delete on public.audit_logs
  for delete using (false);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_select on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

create policy avatars_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy avatars_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
