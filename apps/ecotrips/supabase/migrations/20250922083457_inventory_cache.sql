create schema if not exists catalog;

create table if not exists catalog.search_cache (
  cache_key text primary key,
  params_hash text not null,
  response jsonb not null,
  etag text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_cache_expires_at on catalog.search_cache (expires_at);
create index if not exists idx_search_cache_params_hash on catalog.search_cache (params_hash);

create table if not exists catalog.suppliers (
  id text primary key,
  name text,
  active boolean not null default true,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists catalog.hotels (
  id text primary key,
  name text,
  city text,
  country text,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists catalog.rooms (
  id text primary key,
  hotel_id text references catalog.hotels(id),
  name text,
  meta jsonb not null default '{}'::jsonb
);

alter table catalog.search_cache enable row level security;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'catalog'
       and tablename = 'search_cache'
       and policyname = 'p_search_cache_service'
  ) then
    create policy p_search_cache_service on catalog.search_cache
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

alter table catalog.suppliers enable row level security;
do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'catalog'
       and tablename = 'suppliers'
       and policyname = 'p_suppliers_service'
  ) then
    create policy p_suppliers_service on catalog.suppliers
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

alter table catalog.hotels enable row level security;
do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'catalog'
       and tablename = 'hotels'
       and policyname = 'p_hotels_service'
  ) then
    create policy p_hotels_service on catalog.hotels
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

alter table catalog.rooms enable row level security;
do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'catalog'
       and tablename = 'rooms'
       and policyname = 'p_rooms_service'
  ) then
    create policy p_rooms_service on catalog.rooms
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

grant select, insert, update, delete on catalog.search_cache to service_role;
grant select, insert, update, delete on catalog.suppliers to service_role;
grant select, insert, update, delete on catalog.hotels to service_role;
grant select, insert, update, delete on catalog.rooms to service_role;
