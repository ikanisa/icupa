-- Travel discovery embeddings, supplier compliance, and storage alignment.
set search_path = public;

create extension if not exists vector;

create schema if not exists travel;

create table if not exists travel.travellers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references core.profiles (id),
  auth_user_id uuid references auth.users (id),
  full_name text,
  home_airport text,
  preferred_languages text[] not null default array[]::text[],
  consent_discovery boolean not null default true,
  preference_embedding vector(64),
  last_preference_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists travel_travellers_profile_idx
  on travel.travellers (profile_id)
  where profile_id is not null;
create index if not exists travel_travellers_auth_user_idx
  on travel.travellers (auth_user_id)
  where auth_user_id is not null;

comment on table travel.travellers is 'Traveller preferences captured for discovery workflows (opt-in embeddings).';
comment on column travel.travellers.preference_embedding is 'Vector(64) embedding derived from traveller preferences.';

create table if not exists travel.suppliers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  contact_email text,
  licence_status text not null default 'pending' check (licence_status in ('pending','verified','expired','under_review')),
  licence_document_path text,
  licence_expires_at date,
  menu_document_path text,
  ingestion_source text,
  last_ingested_at timestamptz,
  catalogue_embedding vector(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists travel.trips (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid references travel.travellers (id),
  itinerary_id uuid references booking.itineraries (id),
  supplier_id uuid references travel.suppliers (id),
  trip_name text not null,
  trip_kind text not null default 'personal' check (trip_kind in ('personal','discovery','event_series')),
  summary text,
  discovery_key text unique,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft','planning','booked','archived')),
  ingestion_source text,
  last_ingested_at timestamptz,
  discovery_embedding vector(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_trips_traveller_idx on travel.trips (traveller_id) where traveller_id is not null;
create index if not exists travel_trips_itinerary_idx on travel.trips (itinerary_id) where itinerary_id is not null;
create index if not exists travel_trips_kind_idx on travel.trips (trip_kind);
create index if not exists travel_trips_ingested_idx on travel.trips (last_ingested_at desc nulls last);
create index if not exists travel_trips_embedding_idx on travel.trips
  using ivfflat (discovery_embedding vector_cosine_ops) with (lists = 100);

comment on table travel.trips is 'Trip records spanning traveller journeys and discovery snapshots.';
comment on column travel.trips.discovery_embedding is 'Vector(64) embedding summarising itinerary semantics for discovery matches.';

create table if not exists travel.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references travel.trips (id) on delete cascade,
  booking_item_id uuid references booking.items (id),
  item_kind text not null check (item_kind in ('poi','event','lodging','dining','transfer','note')),
  title text not null,
  summary text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  start_at timestamptz,
  end_at timestamptz,
  embedding vector(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_itinerary_items_source_unique unique (trip_id, source_url)
);

create index if not exists travel_itinerary_items_trip_idx on travel.itinerary_items (trip_id);
create index if not exists travel_itinerary_items_kind_idx on travel.itinerary_items (item_kind);
create index if not exists travel_itinerary_items_embedding_idx on travel.itinerary_items
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

comment on table travel.itinerary_items is 'Discovery itinerary catalog enriched with embeddings for POI and event search.';

create table if not exists travel.reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references travel.trips (id) on delete cascade,
  supplier_id uuid references travel.suppliers (id),
  reservation_kind text not null default 'hold' check (reservation_kind in ('hold','confirmed','waitlist')),
  status text not null default 'tentative' check (status in ('tentative','confirmed','cancelled')),
  confirmation_code text,
  external_ref text,
  booked_at timestamptz,
  hold_expires_at timestamptz,
  inventory_reference text,
  embedding vector(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists travel_reservations_external_idx
  on travel.reservations (trip_id, coalesce(external_ref, confirmation_code));
create index if not exists travel_reservations_status_idx on travel.reservations (status);
create index if not exists travel_reservations_embedding_idx on travel.reservations
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

comment on table travel.reservations is 'Supplier reservations connected to discovery itineraries with embeddings for conflict checks.';

create or replace function travel.touch_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'travel_travellers_set_updated_at') then
    create trigger travel_travellers_set_updated_at
      before update on travel.travellers
      for each row execute function travel.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'travel_suppliers_set_updated_at') then
    create trigger travel_suppliers_set_updated_at
      before update on travel.suppliers
      for each row execute function travel.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'travel_trips_set_updated_at') then
    create trigger travel_trips_set_updated_at
      before update on travel.trips
      for each row execute function travel.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'travel_itinerary_items_set_updated_at') then
    create trigger travel_itinerary_items_set_updated_at
      before update on travel.itinerary_items
      for each row execute function travel.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'travel_reservations_set_updated_at') then
    create trigger travel_reservations_set_updated_at
      before update on travel.reservations
      for each row execute function travel.touch_updated_at();
  end if;
end$$;

alter table travel.travellers enable row level security;
alter table travel.suppliers enable row level security;
alter table travel.trips enable row level security;
alter table travel.itinerary_items enable row level security;
alter table travel.reservations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'travellers' and policyname = 'travel_travellers_block_public'
  ) then
    create policy travel_travellers_block_public on travel.travellers
      for all using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'travellers' and policyname = 'travel_travellers_service_manage'
  ) then
    create policy travel_travellers_service_manage on travel.travellers
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'travellers' and policyname = 'travel_travellers_self_access'
  ) then
    create policy travel_travellers_self_access on travel.travellers
      for select using (
        (auth.uid() is not null and auth.uid() = auth_user_id)
        or sec.has_role('ops')
        or sec.has_role('admin')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'travellers' and policyname = 'travel_travellers_self_write'
  ) then
    create policy travel_travellers_self_write on travel.travellers
      for insert with check (auth.uid() is not null and auth.uid() = auth_user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'travellers' and policyname = 'travel_travellers_self_update'
  ) then
    create policy travel_travellers_self_update on travel.travellers
      for update using (auth.uid() is not null and auth.uid() = auth_user_id)
      with check (auth.uid() is not null and auth.uid() = auth_user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'suppliers' and policyname = 'travel_suppliers_block_public'
  ) then
    create policy travel_suppliers_block_public on travel.suppliers
      for all using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'suppliers' and policyname = 'travel_suppliers_service_manage'
  ) then
    create policy travel_suppliers_service_manage on travel.suppliers
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'suppliers' and policyname = 'travel_suppliers_ops_read'
  ) then
    create policy travel_suppliers_ops_read on travel.suppliers
      for select using (sec.has_role('ops') or sec.has_role('admin'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'trips' and policyname = 'travel_trips_block_public'
  ) then
    create policy travel_trips_block_public on travel.trips
      for all using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'trips' and policyname = 'travel_trips_service_manage'
  ) then
    create policy travel_trips_service_manage on travel.trips
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'trips' and policyname = 'travel_trips_ops_read'
  ) then
    create policy travel_trips_ops_read on travel.trips
      for select using (sec.has_role('ops') or sec.has_role('admin'));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'trips' and policyname = 'travel_trips_owner_access'
  ) then
    create policy travel_trips_owner_access on travel.trips
      for select using (
        exists (
          select 1 from travel.travellers tv
          where tv.id = travel.trips.traveller_id
            and tv.auth_user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'trips' and policyname = 'travel_trips_owner_write'
  ) then
    create policy travel_trips_owner_write on travel.trips
      for insert with check (
        exists (
          select 1 from travel.travellers tv
          where tv.id = travel.trips.traveller_id
            and tv.auth_user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'trips' and policyname = 'travel_trips_owner_update'
  ) then
    create policy travel_trips_owner_update on travel.trips
      for update using (
        exists (
          select 1 from travel.travellers tv
          where tv.id = travel.trips.traveller_id
            and tv.auth_user_id = auth.uid()
        )
      ) with check (
        exists (
          select 1 from travel.travellers tv
          where tv.id = travel.trips.traveller_id
            and tv.auth_user_id = auth.uid()
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'itinerary_items' and policyname = 'travel_itinerary_items_block_public'
  ) then
    create policy travel_itinerary_items_block_public on travel.itinerary_items
      for all using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'itinerary_items' and policyname = 'travel_itinerary_items_service_manage'
  ) then
    create policy travel_itinerary_items_service_manage on travel.itinerary_items
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'itinerary_items' and policyname = 'travel_itinerary_items_traveller_access'
  ) then
    create policy travel_itinerary_items_traveller_access on travel.itinerary_items
      for select using (
        exists (
          select 1
          from travel.trips t
          join travel.travellers tv on tv.id = t.traveller_id
          where t.id = travel.itinerary_items.trip_id
            and tv.auth_user_id = auth.uid()
        )
        or sec.has_role('ops')
        or sec.has_role('admin')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'itinerary_items' and policyname = 'travel_itinerary_items_traveller_write'
  ) then
    create policy travel_itinerary_items_traveller_write on travel.itinerary_items
      for insert with check (
        exists (
          select 1
          from travel.trips t
          join travel.travellers tv on tv.id = t.traveller_id
          where t.id = travel.itinerary_items.trip_id
            and tv.auth_user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'itinerary_items' and policyname = 'travel_itinerary_items_traveller_update'
  ) then
    create policy travel_itinerary_items_traveller_update on travel.itinerary_items
      for update using (
        exists (
          select 1
          from travel.trips t
          join travel.travellers tv on tv.id = t.traveller_id
          where t.id = travel.itinerary_items.trip_id
            and tv.auth_user_id = auth.uid()
        )
      ) with check (
        exists (
          select 1
          from travel.trips t
          join travel.travellers tv on tv.id = t.traveller_id
          where t.id = travel.itinerary_items.trip_id
            and tv.auth_user_id = auth.uid()
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'reservations' and policyname = 'travel_reservations_block_public'
  ) then
    create policy travel_reservations_block_public on travel.reservations
      for all using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'reservations' and policyname = 'travel_reservations_service_manage'
  ) then
    create policy travel_reservations_service_manage on travel.reservations
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'reservations' and policyname = 'travel_reservations_traveller_access'
  ) then
    create policy travel_reservations_traveller_access on travel.reservations
      for select using (
        exists (
          select 1
          from travel.trips t
          join travel.travellers tv on tv.id = t.traveller_id
          where t.id = travel.reservations.trip_id
            and tv.auth_user_id = auth.uid()
        )
        or sec.has_role('ops')
        or sec.has_role('admin')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'reservations' and policyname = 'travel_reservations_traveller_write'
  ) then
    create policy travel_reservations_traveller_write on travel.reservations
      for insert with check (
        exists (
          select 1
          from travel.trips t
          join travel.travellers tv on tv.id = t.traveller_id
          where t.id = travel.reservations.trip_id
            and tv.auth_user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'travel' and tablename = 'reservations' and policyname = 'travel_reservations_traveller_update'
  ) then
    create policy travel_reservations_traveller_update on travel.reservations
      for update using (
        exists (
          select 1
          from travel.trips t
          join travel.travellers tv on tv.id = t.traveller_id
          where t.id = travel.reservations.trip_id
            and tv.auth_user_id = auth.uid()
        )
      ) with check (
        exists (
          select 1
          from travel.trips t
          join travel.travellers tv on tv.id = t.traveller_id
          where t.id = travel.reservations.trip_id
            and tv.auth_user_id = auth.uid()
        )
      );
  end if;
end$$;

grant usage on schema travel to service_role;
grant usage on schema travel to authenticated;

grant select, insert, update, delete on table travel.travellers to service_role;
grant select, insert, update on table travel.travellers to authenticated;

grant select, insert, update, delete on table travel.suppliers to service_role;
grant select on table travel.suppliers to authenticated;

grant select, insert, update, delete on table travel.trips to service_role;
grant select, insert, update on table travel.trips to authenticated;

grant select, insert, update, delete on table travel.itinerary_items to service_role;
grant select, insert, update on table travel.itinerary_items to authenticated;

grant select, insert, update, delete on table travel.reservations to service_role;
grant select, insert, update on table travel.reservations to authenticated;

create or replace view ops.v_supplier_licence_status as
select
  s.id as supplier_id,
  s.slug as supplier_slug,
  s.display_name,
  s.licence_status,
  s.licence_expires_at,
  s.licence_document_path,
  s.menu_document_path,
  s.last_ingested_at,
  s.ingestion_source,
  case
    when s.licence_expires_at is not null then greatest(0, date_part('day', s.licence_expires_at - current_date))
    else null
  end as days_until_expiry,
  case
    when s.last_ingested_at is not null then round(extract(epoch from (now() - s.last_ingested_at)) / 3600.0, 2)
    else null
  end as hours_since_ingest
from travel.suppliers s;

comment on view ops.v_supplier_licence_status is 'Supplier licence compliance surface for ops console dashboards.';

create or replace view ops.v_travel_ingestion_health as
select
  t.id as trip_id,
  t.trip_name,
  t.trip_kind,
  t.discovery_key,
  t.summary,
  t.last_ingested_at,
  t.ingestion_source,
  case
    when t.last_ingested_at is not null then round(extract(epoch from (now() - t.last_ingested_at)) / 3600.0, 2)
    else null
  end as hours_since_refresh,
  count(i.*) filter (where i.item_kind = 'poi') as poi_items,
  count(i.*) filter (where i.item_kind = 'event') as event_items
from travel.trips t
left join travel.itinerary_items i on i.trip_id = t.id
group by t.id;

comment on view ops.v_travel_ingestion_health is 'Aggregation of travel discovery ingestion freshness and item counts.';

create or replace view ops.v_trip_embeddings as
select
  t.id as trip_id,
  t.trip_name,
  t.trip_kind,
  t.itinerary_id,
  t.discovery_key,
  t.last_ingested_at,
  vector_dims(t.discovery_embedding) as embedding_dimensions,
  case when t.discovery_embedding is not null then round(vector_norm(t.discovery_embedding)::numeric, 6) else null end as embedding_norm
from travel.trips t
where t.discovery_embedding is not null;

comment on view ops.v_trip_embeddings is 'Expose itinerary embeddings for admin review without leaking raw vectors.';

grant select on ops.v_supplier_licence_status to authenticated;
grant select on ops.v_supplier_licence_status to service_role;

grant select on ops.v_travel_ingestion_health to authenticated;
grant select on ops.v_travel_ingestion_health to service_role;

grant select on ops.v_trip_embeddings to authenticated;
grant select on ops.v_trip_embeddings to service_role;

insert into storage.buckets (id, name, public)
values
  ('supplier-licences', 'supplier-licences', false),
  ('supplier-menus', 'supplier-menus', false)
on conflict (id) do nothing;

comment on column storage.buckets.name is 'Logical bucket identifier (duplicate of id for clarity).';

alter table if exists storage.objects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_licences_service_manage'
  ) then
    create policy supplier_licences_service_manage on storage.objects
      for all using (bucket_id = 'supplier-licences' and auth.role() = 'service_role')
      with check (bucket_id = 'supplier-licences' and auth.role() = 'service_role');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_licences_ops_read'
  ) then
    create policy supplier_licences_ops_read on storage.objects
      for select using (bucket_id = 'supplier-licences' and (sec.has_role('ops') or sec.has_role('admin')));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_menus_service_manage'
  ) then
    create policy supplier_menus_service_manage on storage.objects
      for all using (bucket_id = 'supplier-menus' and auth.role() = 'service_role')
      with check (bucket_id = 'supplier-menus' and auth.role() = 'service_role');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_menus_authenticated_read'
  ) then
    create policy supplier_menus_authenticated_read on storage.objects
      for select using (
        bucket_id = 'supplier-menus'
        and (
          sec.has_role('ops')
          or sec.has_role('admin')
          or coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
        )
      );
  end if;
end$$;

comment on policy supplier_menus_authenticated_read on storage.objects is 'Allow authenticated ops or partners to read supplier menu assets.';

comment on policy supplier_licences_ops_read on storage.objects is 'Ops roles can audit supplier licence uploads.';

