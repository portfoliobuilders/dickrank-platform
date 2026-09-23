-- Profiles, content, likes, subscriptions, and audit logs.
-- Preferences are stored as application-layer AES-256-GCM ciphertext.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  display_name text,
  bio text,
  location text,
  orientation text,
  interests text[] not null default '{}',
  avatar_url text,
  preferences_encrypted text,
  is_creator boolean not null default false,
  is_verified boolean not null default false,
  is_private boolean not null default false,
  accepts_subscriptions boolean not null default true,
  age_verified boolean not null default false,
  age_verified_at timestamptz,
  content_count integer not null default 0,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.content (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  category text,
  media_url text,
  media_type text not null check (media_type in ('image', 'video')),
  thumbnail_url text,
  blur_data_url text,
  qualities jsonb,
  is_premium boolean not null default false,
  like_count integer not null default 0,
  view_count integer not null default 0,
  rating numeric(3, 2),
  status text not null default 'PUBLISHED' check (status in ('DRAFT', 'PUBLISHED', 'DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_status_created_idx on public.content (status, created_at desc);
create index content_status_likes_idx on public.content (status, like_count desc);
create index content_creator_idx on public.content (creator_id, created_at desc);
create index content_category_idx on public.content (category);
create index content_tags_idx on public.content using gin (tags);
create index content_premium_idx on public.content (is_premium, created_at desc);

create table public.content_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);

create table public.creator_subscriptions (
  subscriber_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (subscriber_id, creator_id),
  check (subscriber_id <> creator_id)
);

create table public.creator_schedule (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index creator_schedule_creator_idx on public.creator_schedule (creator_id, starts_at);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  unique (content_id, reporter_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger content_set_updated_at
before update on public.content
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.creator_subscriptions
for each row execute function public.set_updated_at();

create or replace function public.preferences_must_be_ciphertext()
returns trigger
language plpgsql
as $$
begin
  if new.preferences_encrypted is not null and (
    new.preferences_encrypted ~ '^\s*[\{\[]'
    or length(new.preferences_encrypted) < 40
  ) then
    raise exception 'Preferences must be encrypted';
  end if;
  return new;
end;
$$;

create trigger profiles_preferences_ciphertext
before insert or update of preferences_encrypted on public.profiles
for each row execute function public.preferences_must_be_ciphertext();

create or replace function public.sync_profile_content_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'PUBLISHED' then
      update public.profiles
      set content_count = content_count + 1
      where id = new.creator_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status or old.creator_id is distinct from new.creator_id then
      if old.status = 'PUBLISHED' then
        update public.profiles
        set content_count = greatest(content_count - 1, 0)
        where id = old.creator_id;
      end if;
      if new.status = 'PUBLISHED' then
        update public.profiles
        set content_count = content_count + 1
        where id = new.creator_id;
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'PUBLISHED' then
      update public.profiles
      set content_count = greatest(content_count - 1, 0)
      where id = old.creator_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

create trigger content_sync_count
after insert or update or delete on public.content
for each row execute function public.sync_profile_content_count();

create or replace function public.is_age_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select age_verified from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.profile_id_for_username(p_username text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where lower(username) = lower(p_username) limit 1;
$$;

create or replace function public.own_preferences_ciphertext()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select preferences_encrypted from public.profiles where id = auth.uid();
$$;

create or replace function public.save_encrypted_preferences(
  p_ciphertext text,
  p_is_private boolean,
  p_accepts_subscriptions boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_ciphertext is null or p_ciphertext ~ '^\s*[\{\[]' or length(p_ciphertext) < 40 then
    raise exception 'Preferences must be encrypted';
  end if;
  update public.profiles
  set preferences_encrypted = p_ciphertext,
      is_private = p_is_private,
      accepts_subscriptions = p_accepts_subscriptions
  where id = auth.uid();
end;
$$;

create or replace function public.confirm_age_verification()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.profiles
  set age_verified = true,
      age_verified_at = coalesce(age_verified_at, now())
  where id = auth.uid();
  return found;
end;
$$;

create or replace function public.set_follower_count(p_creator_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select count(*) into v_count from public.follows where creator_id = p_creator_id;
  update public.profiles
  set follower_count = v_count
  where id = p_creator_id;
  return v_count;
end;
$$;

create or replace function public.toggle_content_like(p_content_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_exists boolean;
  v_count integer;
  v_verified boolean;
  v_status text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select age_verified into v_verified from public.profiles where id = v_user;
  if v_verified is distinct from true then
    raise exception 'Age verification required';
  end if;

  select status into v_status from public.content where id = p_content_id;
  if v_status is null or v_status = 'DELETED' then
    raise exception 'Content not found';
  end if;

  select exists(
    select 1 from public.content_likes
    where user_id = v_user and content_id = p_content_id
  ) into v_exists;

  if v_exists then
    delete from public.content_likes where user_id = v_user and content_id = p_content_id;
    update public.content
    set like_count = greatest(like_count - 1, 0)
    where id = p_content_id
    returning like_count into v_count;
    return jsonb_build_object('liked', false, 'likeCount', v_count);
  end if;

  insert into public.content_likes (user_id, content_id) values (v_user, p_content_id);
  update public.content
  set like_count = like_count + 1
  where id = p_content_id
  returning like_count into v_count;
  return jsonb_build_object('liked', true, 'likeCount', v_count);
end;
$$;

create or replace function public.increment_content_view(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_age_verified() is distinct from true then
    return;
  end if;
  update public.content
  set view_count = view_count + 1
  where id = p_content_id and status = 'PUBLISHED' and creator_id is distinct from auth.uid();
end;
$$;

revoke all on function public.is_age_verified() from public;
revoke all on function public.profile_id_for_username(text) from public;
revoke all on function public.own_preferences_ciphertext() from public;
revoke all on function public.save_encrypted_preferences(text, boolean, boolean) from public;
revoke all on function public.confirm_age_verification() from public;
revoke all on function public.set_follower_count(uuid) from public;
revoke all on function public.toggle_content_like(uuid) from public;
revoke all on function public.increment_content_view(uuid) from public;

grant execute on function public.is_age_verified() to authenticated;
grant execute on function public.profile_id_for_username(text) to authenticated;
grant execute on function public.own_preferences_ciphertext() to authenticated;
grant execute on function public.save_encrypted_preferences(text, boolean, boolean) to authenticated;
grant execute on function public.confirm_age_verification() to authenticated;
grant execute on function public.set_follower_count(uuid) to authenticated;
grant execute on function public.toggle_content_like(uuid) to authenticated;
grant execute on function public.increment_content_view(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.content enable row level security;
alter table public.content_likes enable row level security;
alter table public.follows enable row level security;
alter table public.creator_subscriptions enable row level security;
alter table public.creator_schedule enable row level security;
alter table public.content_reports enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (public.is_age_verified() or id = auth.uid());

create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy content_select on public.content
for select to authenticated
using ((status = 'PUBLISHED' and public.is_age_verified()) or creator_id = auth.uid());

create policy content_insert on public.content
for insert to authenticated
with check (
  creator_id = auth.uid()
  and public.is_age_verified()
  and exists (select 1 from public.profiles where id = auth.uid() and is_creator)
);

create policy content_update on public.content
for update to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

create policy likes_select on public.content_likes
for select to authenticated
using (public.is_age_verified());

create policy likes_insert on public.content_likes
for insert to authenticated
with check (user_id = auth.uid() and public.is_age_verified());

create policy likes_delete on public.content_likes
for delete to authenticated
using (user_id = auth.uid());

create policy follows_select on public.follows
for select to authenticated
using (public.is_age_verified() or follower_id = auth.uid());

create policy follows_insert on public.follows
for insert to authenticated
with check (follower_id = auth.uid() and public.is_age_verified());

create policy follows_delete on public.follows
for delete to authenticated
using (follower_id = auth.uid());

create policy subscriptions_select on public.creator_subscriptions
for select to authenticated
using (subscriber_id = auth.uid() or creator_id = auth.uid() or public.is_age_verified());

create policy subscriptions_insert on public.creator_subscriptions
for insert to authenticated
with check (subscriber_id = auth.uid() and public.is_age_verified());

create policy subscriptions_update on public.creator_subscriptions
for update to authenticated
using (subscriber_id = auth.uid())
with check (subscriber_id = auth.uid());

create policy schedule_select on public.creator_schedule
for select to authenticated
using (public.is_age_verified() or creator_id = auth.uid());

create policy schedule_write on public.creator_schedule
for all to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

create policy reports_insert on public.content_reports
for insert to authenticated
with check (reporter_id = auth.uid() and public.is_age_verified());

create policy reports_select on public.content_reports
for select to authenticated
using (reporter_id = auth.uid());

create policy audit_insert on public.audit_logs
for insert to authenticated
with check (actor_id = auth.uid());

create policy audit_select on public.audit_logs
for select to authenticated
using (actor_id = auth.uid());

revoke all on table public.profiles from anon, authenticated;
grant select (
  id, username, display_name, bio, location, orientation, interests, avatar_url,
  is_creator, is_verified, is_private, accepts_subscriptions, age_verified, age_verified_at,
  content_count, follower_count, created_at, updated_at
) on public.profiles to authenticated;
grant update (
  display_name, bio, location, orientation, interests, avatar_url
) on public.profiles to authenticated;

revoke all on table public.content from anon, authenticated;
grant select on public.content to authenticated;
grant insert (
  creator_id, title, description, tags, category, media_url, media_type,
  thumbnail_url, blur_data_url, qualities, is_premium, status
) on public.content to authenticated;
grant update (
  title, description, tags, category, media_url, media_type,
  thumbnail_url, blur_data_url, qualities, is_premium, status
) on public.content to authenticated;

revoke all on table public.content_likes from anon, authenticated;
grant select, insert, delete on public.content_likes to authenticated;

revoke all on table public.follows from anon, authenticated;
grant select, insert, delete on public.follows to authenticated;

revoke all on table public.creator_subscriptions from anon, authenticated;
grant select, insert, update on public.creator_subscriptions to authenticated;

revoke all on table public.creator_schedule from anon, authenticated;
grant select, insert, update, delete on public.creator_schedule to authenticated;

revoke all on table public.content_reports from anon, authenticated;
grant select, insert on public.content_reports to authenticated;

revoke all on table public.audit_logs from anon, authenticated;
grant select (id, actor_id, action, entity_type, entity_id, metadata, created_at) on public.audit_logs to authenticated;
grant insert (actor_id, action, entity_type, entity_id, metadata) on public.audit_logs to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatar_public_read on storage.objects
for select to public
using (bucket_id = 'avatars');

create policy avatar_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_age_verified()
);

create policy avatar_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.is_age_verified());

create policy avatar_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
