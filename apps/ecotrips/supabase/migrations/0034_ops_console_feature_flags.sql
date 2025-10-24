-- Ops console feature flags and fixture payloads plus role metadata sync.
set search_path = public;

create schema if not exists ops;
create schema if not exists sec;

-- Feature flag registry for console fallbacks.
create table if not exists ops.console_feature_flags (
  key text primary key,
  description text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists ops.console_fixtures (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table ops.console_feature_flags enable row level security;
alter table ops.console_fixtures enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'ops'
      and tablename = 'console_feature_flags'
      and policyname = 'ops_console_flags_read'
  ) then
    create policy ops_console_flags_read on ops.console_feature_flags
      for select using (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'ops'
      and tablename = 'console_fixtures'
      and policyname = 'ops_console_fixtures_read'
  ) then
    create policy ops_console_fixtures_read on ops.console_fixtures
      for select using (true);
  end if;
end$$;

grant usage on schema ops to authenticated;
grant select on table ops.console_feature_flags to authenticated;
grant select on table ops.console_fixtures to authenticated;

do $$
begin
  insert into ops.console_feature_flags as f (key, description, enabled)
  values
    ('OPS_CONSOLE_BOOKINGS_FIXTURES', 'Serve bookings fixtures when ops-bookings is unavailable.', false),
    ('OPS_CONSOLE_EXCEPTIONS_FIXTURES', 'Serve exceptions fixtures when ops-exceptions is unavailable.', false),
    ('OPS_CONSOLE_GROUPS_REPORT_FIXTURES', 'Serve group payout report fixtures when report function is unavailable.', false),
    ('OPS_CONSOLE_DR_FIXTURES', 'Serve disaster recovery snapshot fixtures when registry is unavailable.', false)
  on conflict (key) do update
    set description = excluded.description;
end$$;

do $$
begin
  insert into ops.console_fixtures as f (key, payload)
  values
    ('ops.bookings', jsonb_build_array(
      jsonb_build_object('id', 'BK-1021', 'user', 'jane@traveler.com', 'status', 'confirmed', 'total', '$1,820', 'createdAt', '2024-05-04'),
      jsonb_build_object('id', 'BK-1022', 'user', 'yves@rwanda.rw', 'status', 'pending', 'total', '$2,410', 'createdAt', '2024-05-04'),
      jsonb_build_object('id', 'BK-1012', 'user', 'amina@ecotrips.africa', 'status', 'refunded', 'total', '$860', 'createdAt', '2024-05-01')
    )),
    ('ops.exceptions', jsonb_build_array(
      jsonb_build_object('id', 'EX-801', 'type', 'stripe-webhook', 'status', 'retrying', 'last_error', 'RATE_LIMIT', 'occurred_at', '2024-05-04T11:05:00Z'),
      jsonb_build_object('id', 'EX-792', 'type', 'wa-send', 'status', 'backoff', 'last_error', 'TIMEOUT', 'occurred_at', '2024-05-04T11:15:00Z')
    )),
    ('groups.payouts.report', jsonb_build_object(
      'counts', jsonb_build_array(
        jsonb_build_object('status', 'succeeded', 'currency', 'USD', 'count', 2),
        jsonb_build_object('status', 'pending', 'currency', 'USD', 'count', 1)
      ),
      'recent', jsonb_build_array(
        jsonb_build_object('id', 'PO-201', 'escrow_id', 'ESC-204', 'total_cents', 482000, 'currency', 'USD', 'status', 'succeeded', 'attempts', 1, 'created_at', '2024-05-04T09:12:00Z'),
        jsonb_build_object('id', 'PO-202', 'escrow_id', 'ESC-205', 'total_cents', 105000, 'currency', 'USD', 'status', 'at_risk', 'attempts', 2, 'last_error', 'expired_no_payout', 'created_at', '2024-05-04T09:15:00Z')
      )
    )),
    ('dr.snapshots', jsonb_build_array(
      jsonb_build_object('id', 'snap-2024-05-04', 'label', 'daily', 'generated_at', '2024-05-04T08:00:00Z', 'tables', 9),
      jsonb_build_object('id', 'snap-2024-05-03', 'label', 'daily', 'generated_at', '2024-05-03T08:00:00Z', 'tables', 9)
    ))
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();
end$$;

-- Synchronise sec.user_roles into Supabase session metadata.
create or replace function sec.sync_user_roles_to_metadata(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  roles text[];
begin
  if p_user is null then
    return;
  end if;

  select coalesce(array_agg(role order by role), array[]::text[])
    into roles
    from sec.user_roles
    where user_id = p_user;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('roles', roles),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('roles', roles)
   where id = p_user;
end;
$$;

create or replace function sec.user_roles_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform sec.sync_user_roles_to_metadata(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'sec_user_roles_sync'
  ) then
    create trigger sec_user_roles_sync
      after insert or update or delete on sec.user_roles
      for each row execute function sec.user_roles_sync_trigger();
  end if;
end$$;

do $$
declare
  rec record;
begin
  for rec in select id from auth.users loop
    perform sec.sync_user_roles_to_metadata(rec.id);
  end loop;
end$$;
