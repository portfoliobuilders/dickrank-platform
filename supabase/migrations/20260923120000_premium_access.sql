-- Premium content access: posts, subscriptions, one-time purchases, and audit logs.
-- Grace period is 3 days after payment_failed_at, matching src/lib/subscription-guard.ts.

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

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  age_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_tiers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  features jsonb not null default '[]'::jsonb,
  is_popular boolean not null default false,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  title text not null,
  preview_text text,
  thumbnail_url text,
  access_type text not null check (access_type in ('public', 'premium', 'purchase')),
  price_cents integer check (price_cents is null or price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_assets (
  content_id uuid primary key references public.content (id) on delete cascade,
  media_url text not null,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  tier_id uuid references public.subscription_tiers (id) on delete set null,
  status text not null check (status in ('ACTIVE', 'CANCELLED', 'PAST_DUE', 'INCOMPLETE', 'EXPIRED')),
  amount_cents integer not null check (amount_cents >= 0),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  renewal_date timestamptz,
  payment_failed_at timestamptz,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  stripe_payment_intent_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (action in ('create', 'update', 'delete')),
  entity text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index content_creator_id_idx on public.content (creator_id);
create index subscription_tiers_creator_id_idx on public.subscription_tiers (creator_id);
create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_creator_id_idx on public.subscriptions (creator_id);
create index subscriptions_user_creator_idx on public.subscriptions (user_id, creator_id);
create index transactions_user_content_idx on public.transactions (user_id, content_id);
create unique index transactions_one_succeeded_per_content
  on public.transactions (user_id, content_id)
  where status = 'succeeded';
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger creators_set_updated_at before update on public.creators
  for each row execute function public.set_updated_at();
create trigger subscription_tiers_set_updated_at before update on public.subscription_tiers
  for each row execute function public.set_updated_at();
create trigger content_set_updated_at before update on public.content
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.creators enable row level security;
alter table public.subscription_tiers enable row level security;
alter table public.content enable row level security;
alter table public.content_assets enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_logs enable row level security;

-- Members can read their own profile. They cannot flip age_verified themselves.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid() and age_verified = false);
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and age_verified = (select p.age_verified from public.profiles p where p.id = auth.uid()));
create policy profiles_delete_own on public.profiles
  for delete using (false);

create policy creators_select_public on public.creators
  for select using (true);
create policy creators_insert_own on public.creators
  for insert with check (profile_id = auth.uid());
create policy creators_update_own on public.creators
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy creators_delete_own on public.creators
  for delete using (profile_id = auth.uid());

create policy tiers_select_public on public.subscription_tiers
  for select using (true);
create policy tiers_insert_own on public.subscription_tiers
  for insert with check (
    exists (select 1 from public.creators c where c.id = creator_id and c.profile_id = auth.uid())
  );
create policy tiers_update_own on public.subscription_tiers
  for update using (
    exists (select 1 from public.creators c where c.id = creator_id and c.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.creators c where c.id = creator_id and c.profile_id = auth.uid())
  );
create policy tiers_delete_own on public.subscription_tiers
  for delete using (
    exists (select 1 from public.creators c where c.id = creator_id and c.profile_id = auth.uid())
  );

-- Post metadata is public. The protected file lives in content_assets.
create policy content_select_public on public.content
  for select using (true);
create policy content_insert_own on public.content
  for insert with check (
    exists (select 1 from public.creators c where c.id = creator_id and c.profile_id = auth.uid())
  );
create policy content_update_own on public.content
  for update using (
    exists (select 1 from public.creators c where c.id = creator_id and c.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.creators c where c.id = creator_id and c.profile_id = auth.uid())
  );
create policy content_delete_own on public.content
  for delete using (
    exists (select 1 from public.creators c where c.id = creator_id and c.profile_id = auth.uid())
  );

create policy content_assets_select_entitled on public.content_assets
  for select using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.age_verified = true
    )
    and exists (
      select 1
      from public.content c
      where c.id = content_assets.content_id
        and (
          c.access_type = 'public'
          or (
            c.access_type = 'premium'
            and exists (
              select 1
              from public.subscriptions s
              where s.user_id = auth.uid()
                and s.creator_id = c.creator_id
                and (
                  s.status = 'ACTIVE'
                  or (s.status = 'CANCELLED' and s.end_date > now())
                  or (
                    s.status = 'PAST_DUE'
                    and s.payment_failed_at is not null
                    and s.payment_failed_at + interval '3 days' > now()
                  )
                )
            )
          )
          or (
            (c.access_type = 'purchase' or (c.access_type = 'premium' and c.price_cents > 0))
            and exists (
              select 1
              from public.transactions t
              where t.user_id = auth.uid()
                and t.content_id = c.id
                and t.status = 'succeeded'
            )
          )
        )
    )
  );
create policy content_assets_insert_own on public.content_assets
  for insert with check (
    exists (
      select 1
      from public.content c
      join public.creators cr on cr.id = c.creator_id
      where c.id = content_id
        and cr.profile_id = auth.uid()
    )
  );
create policy content_assets_update_own on public.content_assets
  for update using (
    exists (
      select 1
      from public.content c
      join public.creators cr on cr.id = c.creator_id
      where c.id = content_id
        and cr.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.content c
      join public.creators cr on cr.id = c.creator_id
      where c.id = content_id
        and cr.profile_id = auth.uid()
    )
  );
create policy content_assets_delete_own on public.content_assets
  for delete using (
    exists (
      select 1
      from public.content c
      join public.creators cr on cr.id = c.creator_id
      where c.id = content_id
        and cr.profile_id = auth.uid()
    )
  );

-- Purchases and subscription status changes go through server routes (service role).
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());
create policy subscriptions_insert_none on public.subscriptions
  for insert with check (false);
create policy subscriptions_update_none on public.subscriptions
  for update using (false);
create policy subscriptions_delete_none on public.subscriptions
  for delete using (false);

create policy transactions_select_own on public.transactions
  for select using (user_id = auth.uid());
create policy transactions_insert_none on public.transactions
  for insert with check (false);
create policy transactions_update_none on public.transactions
  for update using (false);
create policy transactions_delete_none on public.transactions
  for delete using (false);

create policy audit_logs_select_own on public.audit_logs
  for select using (actor_id = auth.uid());
create policy audit_logs_insert_none on public.audit_logs
  for insert with check (false);
create policy audit_logs_update_none on public.audit_logs
  for update using (false);
create policy audit_logs_delete_none on public.audit_logs
  for delete using (false);

grant select (id, display_name, avatar_url, age_verified) on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select on public.creators to anon, authenticated;
grant select on public.subscription_tiers to anon, authenticated;
grant select on public.content to anon, authenticated;
grant select on public.content_assets to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.transactions to authenticated;
grant select on public.audit_logs to authenticated;
