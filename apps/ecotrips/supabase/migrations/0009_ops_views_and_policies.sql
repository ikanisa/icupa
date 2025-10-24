create schema if not exists sec;

create or replace function sec.is_ops(u uuid)
returns boolean
language sql
security definer
set search_path = core, public
as $$
  select exists (
    select 1
    from core.profiles p
    where p.auth_user_id = u
      and p.persona = 'ops'
  );
$$;

create schema if not exists ops;

drop view if exists ops.v_bookings;
drop view if exists ops.v_exceptions;

create table if not exists ops.exceptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null check (status in ('open','retrying','resolved')),
  last_error text,
  created_at timestamptz not null default now()
);

create or replace view ops.v_bookings as
select
  i.id,
  i.created_at,
  i.status,
  i.total_cents,
  i.currency,
  exists (
    select 1
    from booking.items bi
    where bi.itinerary_id = i.id
  ) as has_items,
  coalesce(
    (
      select min(bi.supplier_ref)
      from booking.items bi
      where bi.itinerary_id = i.id
    ),
    ''
  ) as primary_supplier
from booking.itineraries i;

create or replace view ops.v_exceptions as
select
  e.id,
  e.kind,
  e.status,
  e.last_error,
  e.created_at
from ops.exceptions e;

alter table booking.itineraries enable row level security;
alter table booking.items enable row level security;
alter table ops.exceptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_itineraries_ops_select_v1'
      and schemaname = 'booking'
      and tablename = 'itineraries'
  ) then
    create policy p_itineraries_ops_select_v1 on booking.itineraries
      for select
      using (sec.is_ops(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_items_ops_select_v1'
      and schemaname = 'booking'
      and tablename = 'items'
  ) then
    create policy p_items_ops_select_v1 on booking.items
      for select
      using (sec.is_ops(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_ops_exceptions_select_v1'
      and schemaname = 'ops'
      and tablename = 'exceptions'
  ) then
    create policy p_ops_exceptions_select_v1 on ops.exceptions
      for select
      using (sec.is_ops(auth.uid()));
  end if;
end
$$;

grant usage on schema ops to authenticated;
grant select on ops.v_bookings to authenticated;
grant select on ops.v_exceptions to authenticated;
