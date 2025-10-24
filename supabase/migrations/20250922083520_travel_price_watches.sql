-- Travel price watch registry for air fare monitoring.
set search_path = public;

create schema if not exists travel;

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pronamespace = 'travel'::regnamespace
  ) then
    execute 'create function travel.set_updated_at()
      returns trigger
      language plpgsql
      as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$';
  end if;
end$$;

create table if not exists travel.price_watches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  origin text not null,
  destination text not null,
  departure_date date not null,
  return_date date,
  currency text not null default 'USD',
  target_price_cents integer not null check (target_price_cents > 0),
  contact text,
  channel text not null default 'chat',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  next_refresh_at timestamptz,
  notes text
);

create index if not exists price_watches_route_idx
  on travel.price_watches (origin, destination, departure_date);

create index if not exists price_watches_status_idx
  on travel.price_watches (status);

create trigger set_price_watches_updated_at
  before update on travel.price_watches
  for each row
  execute function travel.set_updated_at();

alter table travel.price_watches enable row level security;

grant usage on schema travel to service_role;

grant usage on schema travel to authenticated;

grant select on table travel.price_watches to authenticated;
grant all privileges on table travel.price_watches to service_role;
