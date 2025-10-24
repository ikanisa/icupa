-- B2B partner API keys and travel intents with strict access controls.
set search_path = public;

create schema if not exists b2b;
create schema if not exists travel;

create table if not exists b2b.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  key_prefix text not null,
  key_hash text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  scopes text[] not null default array[]::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id),
  revoked_reason text,
  last_used_at timestamptz,
  last_ip inet,
  usage_count bigint not null default 0,
  constraint b2b_api_keys_prefix_length check (char_length(key_prefix) >= 8),
  constraint b2b_api_keys_hash_length check (char_length(key_hash) = 64)
);

create unique index if not exists b2b_api_keys_key_prefix_idx
  on b2b.api_keys (key_prefix);
create index if not exists b2b_api_keys_status_idx
  on b2b.api_keys (status);
create index if not exists b2b_api_keys_scopes_gin
  on b2b.api_keys using gin (scopes);

comment on table b2b.api_keys is 'Registry of hashed API keys issued to B2B partners with scope-based access.';
comment on column b2b.api_keys.key_prefix is 'First characters of the issued key for lookup and masking.';
comment on column b2b.api_keys.key_hash is 'Hex-encoded SHA-256 hash of the issued API key.';
comment on column b2b.api_keys.scopes is 'Allowed scopes for the key (inventory.read, leads.write, etc).';

create table if not exists travel.intents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  api_key_id uuid references b2b.api_keys (id),
  company_name text not null,
  contact_name text,
  email text not null,
  phone text,
  party_size integer,
  start_date date,
  end_date date,
  destinations text[] not null default array[]::text[],
  budget_min_cents bigint,
  budget_max_cents bigint,
  notes text,
  idempotency_key text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'in_review', 'converted', 'archived'))
);

create unique index if not exists travel_intents_idempotency_idx
  on travel.intents (idempotency_key);
create index if not exists travel_intents_api_key_idx
  on travel.intents (api_key_id);

comment on table travel.intents is 'Inbound partner lead intents captured via B2B APIs.';
comment on column travel.intents.raw_payload is 'Original request payload for auditing and replay.';

create or replace function travel.set_intent_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'travel_intents_set_updated_at'
  ) then
    create trigger travel_intents_set_updated_at
      before update on travel.intents
      for each row execute function travel.set_intent_updated_at();
  end if;
end$$;

alter table b2b.api_keys enable row level security;
alter table travel.intents enable row level security;

revoke all on b2b.api_keys from anon;
revoke all on b2b.api_keys from authenticated;
revoke all on travel.intents from anon;
revoke all on travel.intents from authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'b2b'
      and tablename = 'api_keys'
      and policyname = 'b2b_api_keys_block_public'
  ) then
    create policy b2b_api_keys_block_public on b2b.api_keys
      for all
      using (false)
      with check (false);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'b2b'
      and tablename = 'api_keys'
      and policyname = 'b2b_api_keys_ops_read'
  ) then
    create policy b2b_api_keys_ops_read on b2b.api_keys
      for select
      using (sec.has_role('ops') or sec.has_role('admin'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel'
      and tablename = 'intents'
      and policyname = 'travel_intents_block_public'
  ) then
    create policy travel_intents_block_public on travel.intents
      for all
      using (false)
      with check (false);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel'
      and tablename = 'intents'
      and policyname = 'travel_intents_ops_read'
  ) then
    create policy travel_intents_ops_read on travel.intents
      for select
      using (sec.has_role('ops') or sec.has_role('admin'));
  end if;
end$$;

grant usage on schema b2b to service_role;
grant usage on schema b2b to authenticated;
grant select, insert, update, delete on table b2b.api_keys to service_role;
grant select on table b2b.api_keys to authenticated;

grant usage on schema travel to service_role;
grant usage on schema travel to authenticated;
grant select, insert, update, delete on table travel.intents to service_role;
grant select on table travel.intents to authenticated;
