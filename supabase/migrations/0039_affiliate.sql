-- Affiliate partner registry and event log with RLS protections.
set search_path = public;

create schema if not exists affiliate;

create or replace function affiliate.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists affiliate.partner (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]+$'),
  name text not null,
  contact_email text,
  signing_secret text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table affiliate.partner is 'Affiliate partner directory with signing metadata for webhook integrations.';
comment on column affiliate.partner.slug is 'Human readable identifier referenced by partner integrations.';
comment on column affiliate.partner.signing_secret is 'Shared secret used for HMAC signatures (never checked into source control).';

create table if not exists affiliate.events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references affiliate.partner (id) on delete set null,
  partner_slug text not null,
  partner_name text,
  direction text not null check (direction in ('inbound', 'outbound')),
  event_type text not null,
  request_id text,
  signature_version text,
  signature text,
  signature_status text not null default 'unknown' check (signature_status in ('valid', 'invalid', 'missing', 'skipped', 'unknown')),
  signature_error text,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb,
  raw_body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table affiliate.events is 'Captured webhook events for affiliate partners (both inbound deliveries and outbound simulations).';
comment on column affiliate.events.headers is 'Subset of request headers recorded for audit and debugging.';
comment on column affiliate.events.metadata is 'Structured diagnostic metadata (signature comparisons, dry run flags, actor ids).';

create index if not exists affiliate_events_partner_created_idx
  on affiliate.events (partner_slug, created_at desc);
create index if not exists affiliate_events_direction_idx
  on affiliate.events (direction, created_at desc);
create index if not exists affiliate_events_signature_status_idx
  on affiliate.events (signature_status);

create or replace view affiliate.events_view
with (security_barrier = true, security_invoker = true)
as
select
  e.id,
  e.created_at,
  e.direction,
  e.event_type,
  e.request_id,
  e.partner_id,
  e.partner_slug,
  coalesce(e.partner_name, p.name) as partner_name,
  e.signature_version,
  e.signature,
  e.signature_status,
  e.signature_error,
  e.metadata,
  e.headers,
  e.payload,
  e.raw_body
from affiliate.events e
  left join affiliate.partner p on p.id = e.partner_id;

comment on view affiliate.events_view is 'Ops-friendly projection of affiliate events with partner metadata when available.';

create trigger set_affiliate_partner_updated_at
  before update on affiliate.partner
  for each row
  execute function affiliate.set_updated_at();

alter table affiliate.partner enable row level security;
alter table affiliate.events enable row level security;

-- Service role retains full control over affiliate tables.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'affiliate'
      and tablename = 'partner'
      and policyname = 'affiliate_partner_service_all'
  ) then
    create policy affiliate_partner_service_all on affiliate.partner
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'affiliate'
      and tablename = 'events'
      and policyname = 'affiliate_events_service_all'
  ) then
    create policy affiliate_events_service_all on affiliate.events
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end$$;

-- Ops users can review partner metadata and event history.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'affiliate'
      and tablename = 'partner'
      and policyname = 'affiliate_partner_ops_read'
  ) then
    create policy affiliate_partner_ops_read on affiliate.partner
      for select
      using (sec.has_role('ops'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'affiliate'
      and tablename = 'events'
      and policyname = 'affiliate_events_ops_read'
  ) then
    create policy affiliate_events_ops_read on affiliate.events
      for select
      using (sec.has_role('ops'));
  end if;
end$$;

grant usage on schema affiliate to authenticated;
grant select on table affiliate.partner to authenticated;
grant select on table affiliate.events to authenticated;
grant select on table affiliate.events_view to authenticated;

grant usage on schema affiliate to service_role;
grant select, insert, update, delete on all tables in schema affiliate to service_role;
