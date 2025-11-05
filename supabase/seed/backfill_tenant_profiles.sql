--
-- This script materialises the new tenant metadata tables introduced during
-- the repository refactor. It is designed to be idempotent so it can be safely
-- executed multiple times via `supabase db remote commit` in staging and
-- production environments.

create extension if not exists "pgcrypto";

set search_path = public;
set client_min_messages = warning;

begin;

-- Ensure canonical tenant profile table exists with the expected shape.
create table if not exists tenant_profiles (
  id uuid primary key references public.tenants(id) on delete cascade,
  slug text not null,
  display_name text,
  timezone text not null default 'UTC',
  billing_plan text not null default 'standard',
  contact_email text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep schema aligned if the table already existed but was missing columns.
alter table tenant_profiles
  add column if not exists slug text,
  add column if not exists display_name text,
  add column if not exists timezone text default 'UTC',
  add column if not exists billing_plan text default 'standard',
  add column if not exists contact_email text,
  add column if not exists status text default 'active',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists tenant_profiles_slug_key on tenant_profiles (slug);

-- Upsert tenant profile rows derived from the legacy tenants table.
with source as (
  select
    t.id,
    t.name,
    t.region,
    t.settings,
    t.created_by,
    coalesce(
      nullif(lower(regexp_replace(t.name, '[^a-z0-9]+', '-', 'g')), ''),
      substring(encode(digest(t.id::text, 'sha256'), 'hex') from 1 for 24)
    ) as slug,
    coalesce(t.settings->>'display_name', t.name) as display_name,
    coalesce(t.settings->>'timezone', 'UTC') as timezone,
    coalesce(t.settings->>'billing_plan', 'standard') as billing_plan,
    t.settings->>'contact_email' as contact_email,
    coalesce(t.settings->>'status', 'active') as status,
    jsonb_build_object(
      'region', t.region,
      'settings', t.settings,
      'created_by', t.created_by
    ) as metadata
  from public.tenants t
)
insert into tenant_profiles as tp (
  id,
  slug,
  display_name,
  timezone,
  billing_plan,
  contact_email,
  status,
  metadata,
  created_at,
  updated_at
)
select
  s.id,
  s.slug,
  s.display_name,
  s.timezone,
  s.billing_plan,
  s.contact_email,
  s.status,
  s.metadata,
  coalesce(tp.created_at, now()),
  now()
from source s
left join tenant_profiles tp on tp.id = s.id
on conflict (id) do update
set
  slug = excluded.slug,
  display_name = excluded.display_name,
  timezone = excluded.timezone,
  billing_plan = excluded.billing_plan,
  contact_email = excluded.contact_email,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

-- Maintain legacy compatibility view for the old code paths.
create or replace view public.vw_tenant_profiles as
select
  tp.id,
  tp.slug,
  tp.display_name,
  tp.timezone,
  tp.billing_plan,
  tp.contact_email,
  tp.status,
  tp.metadata,
  tp.created_at,
  tp.updated_at
from tenant_profiles tp;

-- Ensure read access aligns with tenant scoped policies.
grant select on tenant_profiles to authenticated;
grant select on tenant_profiles to service_role;

-- Audit table capturing migration status for observability dashboards.
create table if not exists tenant_migration_audit (
  id bigserial primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  task text not null,
  rows_affected integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists tenant_migration_audit_tenant_task_idx
  on tenant_migration_audit (tenant_id, task);

insert into tenant_migration_audit (tenant_id, task, rows_affected, metadata)
select
  tp.id,
  'backfill_tenant_profiles'::text,
  1,
  jsonb_build_object(
    'slug', tp.slug,
    'billing_plan', tp.billing_plan,
    'timezone', tp.timezone
  )
from tenant_profiles tp
on conflict (tenant_id, task) do update
set
  rows_affected = excluded.rows_affected,
  metadata = excluded.metadata,
  created_at = now();

commit;
