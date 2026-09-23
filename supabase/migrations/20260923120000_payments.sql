-- Payments, subscriptions, tips, and creator payouts.
-- Service-role writes bypass RLS. Authenticated policies cover select/insert/update/delete.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email_encrypted text,
  phone_encrypted text,
  age_verified boolean not null default false,
  role text not null default 'fan' check (role in ('fan', 'creator', 'admin')),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  username text,
  display_name text,
  country text not null default 'US',
  stripe_account_id text unique,
  transfers_active boolean not null default false,
  payouts_active boolean not null default false,
  identity_verified boolean not null default false,
  bank_account_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index creators_username_key on public.creators (lower(username));

create table public.creator_balances (
  creator_id uuid primary key references public.creators (id) on delete cascade,
  balance_cents integer not null default 0 check (balance_cents >= 0),
  pending_cents integer not null default 0 check (pending_cents >= 0),
  updated_at timestamptz not null default now()
);

create table public.subscription_tiers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 100),
  benefits jsonb not null default '[]'::jsonb,
  stripe_product_id text,
  stripe_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscription_tiers_creator_idx on public.subscription_tiers (creator_id) where active;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  tier_id uuid references public.subscription_tiers (id) on delete set null,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status text not null,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscriber_id, creator_id)
);

create index subscriptions_creator_status_idx on public.subscriptions (creator_id, status);

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  tipper_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  amount_cents integer not null check (amount_cents between 100 and 50000),
  stripe_payment_intent_id text unique,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  payer_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('subscription', 'tip', 'content_sale', 'withdrawal')),
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  net_cents integer not null,
  status text not null,
  stripe_reference text,
  description text,
  created_at timestamptz not null default now()
);

create unique index transactions_stripe_reference_key
  on public.transactions (stripe_reference)
  where stripe_reference is not null;

create index transactions_creator_created_idx on public.transactions (creator_id, created_at desc);

create table public.content_sales (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  buyer_id uuid references public.profiles (id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  stripe_reference text unique,
  created_at timestamptz not null default now()
);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 10000),
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index withdrawals_creator_status_idx on public.withdrawals (creator_id, status);

create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
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

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.age_verified is distinct from old.age_verified
      or new.role is distinct from old.role
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.email_encrypted is distinct from old.email_encrypted
      or new.phone_encrypted is distinct from old.phone_encrypted
    then
      raise exception 'protected_column';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_creator_payout_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.user_id is distinct from old.user_id
      or new.stripe_account_id is distinct from old.stripe_account_id
      or new.transfers_active is distinct from old.transfers_active
      or new.payouts_active is distinct from old.payouts_active
      or new.identity_verified is distinct from old.identity_verified
      or new.bank_account_verified is distinct from old.bank_account_verified
    then
      raise exception 'protected_column';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();
create trigger creators_protect before update on public.creators
  for each row execute function public.protect_creator_payout_columns();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger creators_updated_at before update on public.creators
  for each row execute function public.set_updated_at();
create or replace function public.protect_tier_stripe_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.creator_id is distinct from old.creator_id
      or new.stripe_product_id is distinct from old.stripe_product_id
      or new.stripe_price_id is distinct from old.stripe_price_id
    then
      raise exception 'protected_column';
    end if;
  end if;
  return new;
end;
$$;

create trigger tiers_protect before update on public.subscription_tiers
  for each row execute function public.protect_tier_stripe_columns();
create trigger tiers_updated_at before update on public.subscription_tiers
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger withdrawals_updated_at before update on public.withdrawals
  for each row execute function public.set_updated_at();

-- Ledger helpers. Executable by service_role only.

create or replace function public.credit_creator_earnings(
  p_creator_id uuid,
  p_gross_cents integer,
  p_fee_cents integer,
  p_net_cents integer,
  p_type text,
  p_payer_id uuid,
  p_stripe_reference text,
  p_description text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('subscription', 'tip', 'content_sale') then
    raise exception 'invalid_earning_type';
  end if;
  if p_net_cents < 0 or p_fee_cents < 0 or p_gross_cents < 0 then
    raise exception 'invalid_amount';
  end if;

  insert into public.transactions (
    creator_id, payer_id, type, amount_cents, platform_fee_cents, net_cents, status, stripe_reference, description
  ) values (
    p_creator_id, p_payer_id, p_type, p_gross_cents, p_fee_cents, p_net_cents, 'completed', p_stripe_reference, p_description
  );

  insert into public.creator_balances (creator_id, balance_cents)
  values (p_creator_id, p_net_cents)
  on conflict (creator_id) do update
    set balance_cents = public.creator_balances.balance_cents + excluded.balance_cents,
        updated_at = now();

  if p_type = 'tip' and p_stripe_reference is not null then
    update public.tips
      set status = 'succeeded'
      where stripe_payment_intent_id = p_stripe_reference;
  end if;
exception
  when unique_violation then
    if p_type = 'tip' and p_stripe_reference is not null then
      update public.tips
        set status = 'succeeded'
        where stripe_payment_intent_id = p_stripe_reference;
    end if;
    return;
end;
$$;

create or replace function public.request_withdrawal(
  p_creator_id uuid,
  p_amount_cents integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_id uuid;
begin
  if p_amount_cents < 10000 then
    raise exception 'minimum_withdrawal';
  end if;

  insert into public.creator_balances (creator_id)
  values (p_creator_id)
  on conflict (creator_id) do nothing;

  select balance_cents into v_balance
  from public.creator_balances
  where creator_id = p_creator_id
  for update;

  if v_balance is null or v_balance < p_amount_cents then
    raise exception 'insufficient_balance';
  end if;

  update public.creator_balances
    set balance_cents = balance_cents - p_amount_cents,
        pending_cents = pending_cents + p_amount_cents,
        updated_at = now()
    where creator_id = p_creator_id;

  insert into public.withdrawals (creator_id, amount_cents, status)
  values (p_creator_id, p_amount_cents, 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.mark_withdrawal_processing(
  p_withdrawal_id uuid,
  p_transfer_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.withdrawals
    set status = 'processing',
        stripe_transfer_id = coalesce(p_transfer_id, stripe_transfer_id),
        updated_at = now()
    where id = p_withdrawal_id
      and status = 'pending';
end;
$$;

create or replace function public.complete_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawals%rowtype;
begin
  select * into v_row from public.withdrawals where id = p_withdrawal_id for update;
  if not found or v_row.status in ('completed', 'failed') then
    return;
  end if;

  update public.creator_balances
    set pending_cents = greatest(pending_cents - v_row.amount_cents, 0),
        updated_at = now()
    where creator_id = v_row.creator_id;

  update public.withdrawals
    set status = 'completed',
        updated_at = now()
    where id = p_withdrawal_id;

  insert into public.transactions (
    creator_id, type, amount_cents, platform_fee_cents, net_cents, status, stripe_reference, description
  ) values (
    v_row.creator_id, 'withdrawal', v_row.amount_cents, 0, -v_row.amount_cents, 'completed', v_row.stripe_transfer_id, 'Payout'
  );
end;
$$;

create or replace function public.fail_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawals%rowtype;
begin
  select * into v_row from public.withdrawals where id = p_withdrawal_id for update;
  if not found or v_row.status in ('completed', 'failed') then
    return;
  end if;

  update public.creator_balances
    set balance_cents = balance_cents + v_row.amount_cents,
        pending_cents = greatest(pending_cents - v_row.amount_cents, 0),
        updated_at = now()
    where creator_id = v_row.creator_id;

  update public.withdrawals
    set status = 'failed',
        updated_at = now()
    where id = p_withdrawal_id;
end;
$$;

revoke all on function public.credit_creator_earnings(uuid, integer, integer, integer, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.request_withdrawal(uuid, integer) from public, anon, authenticated;
revoke all on function public.mark_withdrawal_processing(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_withdrawal(uuid) from public, anon, authenticated;
revoke all on function public.fail_withdrawal(uuid) from public, anon, authenticated;

grant execute on function public.credit_creator_earnings(uuid, integer, integer, integer, text, uuid, text, text) to service_role;
grant execute on function public.request_withdrawal(uuid, integer) to service_role;
grant execute on function public.mark_withdrawal_processing(uuid, text) to service_role;
grant execute on function public.complete_withdrawal(uuid) to service_role;
grant execute on function public.fail_withdrawal(uuid) to service_role;

alter table public.profiles enable row level security;
alter table public.creators enable row level security;
alter table public.creator_balances enable row level security;
alter table public.subscription_tiers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tips enable row level security;
alter table public.transactions enable row level security;
alter table public.content_sales enable row level security;
alter table public.withdrawals enable row level security;
alter table public.stripe_events enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (
    id = auth.uid()
    and age_verified = false
    and stripe_customer_id is null
    and role = 'fan'
  );
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (false);

create policy creators_select_own on public.creators
  for select to authenticated using (user_id = auth.uid());
create policy creators_insert_own on public.creators
  for insert to authenticated with check (user_id = auth.uid() and stripe_account_id is null);
create policy creators_update_own on public.creators
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy creators_delete_own on public.creators
  for delete to authenticated using (false);

create policy balances_select_own on public.creator_balances
  for select to authenticated using (
    exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );
create policy balances_insert_none on public.creator_balances
  for insert to authenticated with check (false);
create policy balances_update_none on public.creator_balances
  for update to authenticated using (false);
create policy balances_delete_none on public.creator_balances
  for delete to authenticated using (false);

create policy tiers_select_active on public.subscription_tiers
  for select to anon, authenticated using (
    active
    or exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );
create policy tiers_insert_own on public.subscription_tiers
  for insert to authenticated with check (
    exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
    and stripe_price_id is null
  );
create policy tiers_update_own on public.subscription_tiers
  for update to authenticated using (
    exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );
create policy tiers_delete_own on public.subscription_tiers
  for delete to authenticated using (
    exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );

create policy subscriptions_select_party on public.subscriptions
  for select to authenticated using (
    subscriber_id = auth.uid()
    or exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );
create policy subscriptions_insert_none on public.subscriptions
  for insert to authenticated with check (false);
create policy subscriptions_update_none on public.subscriptions
  for update to authenticated using (false);
create policy subscriptions_delete_none on public.subscriptions
  for delete to authenticated using (false);

create policy tips_select_party on public.tips
  for select to authenticated using (
    tipper_id = auth.uid()
    or exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );
create policy tips_insert_none on public.tips
  for insert to authenticated with check (false);
create policy tips_update_none on public.tips
  for update to authenticated using (false);
create policy tips_delete_none on public.tips
  for delete to authenticated using (false);

create policy transactions_select_own on public.transactions
  for select to authenticated using (
    exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );
create policy transactions_insert_none on public.transactions
  for insert to authenticated with check (false);
create policy transactions_update_none on public.transactions
  for update to authenticated using (false);
create policy transactions_delete_none on public.transactions
  for delete to authenticated using (false);

create policy content_sales_select_own on public.content_sales
  for select to authenticated using (
    buyer_id = auth.uid()
    or exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );
create policy content_sales_insert_none on public.content_sales
  for insert to authenticated with check (false);
create policy content_sales_update_none on public.content_sales
  for update to authenticated using (false);
create policy content_sales_delete_none on public.content_sales
  for delete to authenticated using (false);

create policy withdrawals_select_own on public.withdrawals
  for select to authenticated using (
    exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  );
create policy withdrawals_insert_none on public.withdrawals
  for insert to authenticated with check (false);
create policy withdrawals_update_none on public.withdrawals
  for update to authenticated using (false);
create policy withdrawals_delete_none on public.withdrawals
  for delete to authenticated using (false);

create policy stripe_events_select_none on public.stripe_events
  for select to authenticated using (false);
create policy stripe_events_insert_none on public.stripe_events
  for insert to authenticated with check (false);
create policy stripe_events_update_none on public.stripe_events
  for update to authenticated using (false);
create policy stripe_events_delete_none on public.stripe_events
  for delete to authenticated using (false);

create policy audit_select_own on public.audit_logs
  for select to authenticated using (actor_id = auth.uid());
create policy audit_insert_none on public.audit_logs
  for insert to authenticated with check (false);
create policy audit_update_none on public.audit_logs
  for update to authenticated using (false);
create policy audit_delete_none on public.audit_logs
  for delete to authenticated using (false);
