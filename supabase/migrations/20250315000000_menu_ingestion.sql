-- Menu ingestion OCR schema and RLS policies
set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'menu_ingestion_status_t') then
    create type public.menu_ingestion_status_t as enum (
      'uploaded',
      'processing',
      'awaiting_review',
      'failed',
      'published'
    );
  end if;
end;
$$;

create table if not exists public.menu_ingestions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  original_filename text,
  storage_path text not null,
  file_mime text not null,
  status menu_ingestion_status_t not null default 'uploaded',
  currency char(3),
  pages_processed integer not null default 0,
  items_count integer not null default 0,
  raw_text text,
  structured_json jsonb default '{}'::jsonb,
  errors jsonb default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.menu_items_staging (
  id uuid primary key default uuid_generate_v4(),
  ingestion_id uuid not null references public.menu_ingestions(id) on delete cascade,
  category_name text,
  name text not null,
  description text,
  price_cents integer,
  currency char(3),
  allergens text[] not null default array[]::text[],
  tags text[] not null default array[]::text[],
  is_alcohol boolean not null default false,
  confidence numeric(4,3),
  media_url text,
  flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_menu_ingestions_tenant_location
  on public.menu_ingestions(tenant_id, location_id, status, created_at desc);

create index if not exists idx_menu_ingestions_status
  on public.menu_ingestions(status, updated_at desc);

create index if not exists idx_menu_items_staging_ingestion
  on public.menu_items_staging(ingestion_id, confidence desc, created_at desc);

create or replace function public.touch_menu_ingestions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_touch_menu_ingestions
  before update on public.menu_ingestions
  for each row
  execute function public.touch_menu_ingestions();

create or replace function public.touch_menu_items_staging()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_touch_menu_items_staging
  before update on public.menu_items_staging
  for each row
  execute function public.touch_menu_items_staging();

insert into storage.buckets (id, name)
values
  ('raw_menus', 'raw_menus'),
  ('menu_images', 'menu_images')
on conflict (id) do update set
  name = excluded.name;

do $$
begin
  begin
    execute 'alter table storage.objects enable row level security';
  exception
    when insufficient_privilege then
      raise notice 'Skipping RLS enable on storage.objects due to insufficient privileges';
  end;
end;
$$;

drop policy if exists "Service role manages raw menu objects" on storage.objects;
create policy "Service role manages raw menu objects"
  on storage.objects
  for all using (
    bucket_id = 'raw_menus'
    and auth.role() = 'service_role'
  )
  with check (
    bucket_id = 'raw_menus'
    and auth.role() = 'service_role'
  );

drop policy if exists "Service role manages menu image objects" on storage.objects;
create policy "Service role manages menu image objects"
  on storage.objects
  for all using (
    bucket_id = 'menu_images'
    and auth.role() = 'service_role'
  )
  with check (
    bucket_id = 'menu_images'
    and auth.role() = 'service_role'
  );

alter table public.menu_ingestions enable row level security;
alter table public.menu_items_staging enable row level security;

drop policy if exists "Service role manages menu ingestions" on public.menu_ingestions;
create policy "Service role manages menu ingestions"
  on public.menu_ingestions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages menu items staging" on public.menu_items_staging;
create policy "Service role manages menu items staging"
  on public.menu_items_staging
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Staff read menu ingestions" on public.menu_ingestions;
create policy "Staff read menu ingestions"
  on public.menu_ingestions
  for select
  using (
    is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
    and exists (
      select 1 from public.locations loc
      where loc.id = menu_ingestions.location_id
        and loc.tenant_id = menu_ingestions.tenant_id
    )
  );

drop policy if exists "Staff manage menu ingestions" on public.menu_ingestions;
create policy "Staff manage menu ingestions"
  on public.menu_ingestions
  for all using (
    is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
    and exists (
      select 1 from public.locations loc
      where loc.id = menu_ingestions.location_id
        and loc.tenant_id = menu_ingestions.tenant_id
    )
  )
  with check (
    is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
    and exists (
      select 1 from public.locations loc
      where loc.id = menu_ingestions.location_id
        and loc.tenant_id = menu_ingestions.tenant_id
    )
  );

drop policy if exists "Staff read menu items staging" on public.menu_items_staging;
create policy "Staff read menu items staging"
  on public.menu_items_staging
  for select
  using (
    exists (
      select 1
      from public.menu_ingestions mi
      where mi.id = menu_items_staging.ingestion_id
        and is_staff_for_tenant(mi.tenant_id, array['owner','manager','admin','support']::role_t[])
        and exists (
          select 1 from public.locations loc
          where loc.id = mi.location_id
            and loc.tenant_id = mi.tenant_id
        )
    )
  );

drop policy if exists "Staff manage menu items staging" on public.menu_items_staging;
create policy "Staff manage menu items staging"
  on public.menu_items_staging
  for all using (
    exists (
      select 1
      from public.menu_ingestions mi
      where mi.id = menu_items_staging.ingestion_id
        and is_staff_for_tenant(mi.tenant_id, array['owner','manager','admin','support']::role_t[])
        and exists (
          select 1 from public.locations loc
          where loc.id = mi.location_id
            and loc.tenant_id = mi.tenant_id
        )
    )
  )
  with check (
    exists (
      select 1
      from public.menu_ingestions mi
      where mi.id = menu_items_staging.ingestion_id
        and is_staff_for_tenant(mi.tenant_id, array['owner','manager','admin','support']::role_t[])
        and exists (
          select 1 from public.locations loc
          where loc.id = mi.location_id
            and loc.tenant_id = mi.tenant_id
        )
    )
  );

-- Ensure diner role cannot access ingestion tables
drop policy if exists "Diners denied menu ingestions" on public.menu_ingestions;
create policy "Diners denied menu ingestions"
  on public.menu_ingestions
  for select
  using (false);

drop policy if exists "Diners denied menu staging" on public.menu_items_staging;
create policy "Diners denied menu staging"
  on public.menu_items_staging
  for select
  using (false);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_menu_name_unique'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_menu_name_unique unique (menu_id, name);
  end if;
end;
$$;

create or replace function public.publish_menu_ingestion(
  p_ingestion_id uuid,
  p_menu_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ingestion menu_ingestions%rowtype;
  v_menu record;
  v_items_upserted integer := 0;
  v_categories_created integer := 0;
  v_version integer := 0;
  v_currency char(3);
  v_item menu_items_staging%rowtype;
  v_category_id uuid;
  v_item_id uuid;
  v_item_ids uuid[] := array[]::uuid[];
begin
  select * into v_ingestion from public.menu_ingestions where id = p_ingestion_id for update;
  if not found then
    raise exception 'INGESTION_NOT_FOUND';
  end if;

  select id, tenant_id, location_id, currency, version
    into v_menu
  from public.menus
  where id = p_menu_id
  for update;

  if not found then
    raise exception 'MENU_NOT_FOUND';
  end if;

  if v_menu.tenant_id <> v_ingestion.tenant_id or v_menu.location_id <> v_ingestion.location_id then
    raise exception 'MENU_TENANT_MISMATCH';
  end if;

  v_currency := coalesce(v_ingestion.currency, v_menu.currency::char(3));

  with distinct_categories as (
    select distinct coalesce(nullif(trim(category_name), ''), 'Uncategorised') as name
    from public.menu_items_staging
    where ingestion_id = p_ingestion_id
  )
  insert into public.categories (id, menu_id, name, sort_order)
  select uuid_generate_v4(), p_menu_id, name, row_number() over (order by name)
  from distinct_categories
  on conflict (menu_id, name) do nothing;

  get diagnostics v_categories_created = row_count;

  for v_item in
    select *
    from public.menu_items_staging
    where ingestion_id = p_ingestion_id
    order by coalesce(category_name, 'Uncategorised'), name
  loop
    select id into v_category_id
    from public.categories
    where menu_id = p_menu_id
      and name = coalesce(nullif(trim(v_item.category_name), ''), 'Uncategorised')
    limit 1;

    if v_category_id is null then
      insert into public.categories (id, menu_id, name, sort_order)
      values (
        uuid_generate_v4(),
        p_menu_id,
        coalesce(nullif(trim(v_item.category_name), ''), 'Uncategorised'),
        999
      )
      returning id into v_category_id;
      v_categories_created := v_categories_created + 1;
    end if;

    select id into v_item_id
    from public.items
    where menu_id = p_menu_id
      and lower(name) = lower(v_item.name)
      and price_cents = coalesce(v_item.price_cents, 0)
    limit 1;

    if v_item_id is null then
      insert into public.items (
        id,
        tenant_id,
        location_id,
        menu_id,
        category_id,
        name,
        description,
        price_cents,
        currency,
        allergens,
        tags,
        is_alcohol,
        is_available,
        updated_at,
        media_url
      )
      values (
        uuid_generate_v4(),
        v_ingestion.tenant_id,
        v_ingestion.location_id,
        p_menu_id,
        v_category_id,
        v_item.name,
        v_item.description,
        coalesce(v_item.price_cents, 0),
        coalesce(v_item.currency, v_currency),
        coalesce(v_item.allergens, array[]::text[]),
        coalesce(v_item.tags, array[]::text[]),
        coalesce(v_item.is_alcohol, false),
        true,
        timezone('utc', now()),
        v_item.media_url
      )
      returning id into v_item_id;
    else
      update public.items
      set
        category_id = v_category_id,
        description = v_item.description,
        price_cents = coalesce(v_item.price_cents, price_cents),
        currency = coalesce(v_item.currency, currency),
        allergens = coalesce(v_item.allergens, allergens),
        tags = coalesce(v_item.tags, tags),
        is_alcohol = coalesce(v_item.is_alcohol, is_alcohol),
        updated_at = timezone('utc', now()),
        media_url = coalesce(v_item.media_url, media_url)
      where id = v_item_id;
    end if;

    v_item_ids := array_append(v_item_ids, v_item_id);
    v_items_upserted := v_items_upserted + 1;
  end loop;

  update public.menus
  set
    version = version + 1,
    published_at = timezone('utc', now())
  where id = p_menu_id
  returning version into v_version;

  update public.menu_ingestions
  set
    status = 'published',
    updated_at = timezone('utc', now()),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'published_at', timezone('utc', now()),
      'published_by', p_actor,
      'items_upserted', v_items_upserted
    )
  where id = p_ingestion_id;

  return jsonb_build_object(
    'items_upserted', v_items_upserted,
    'categories_created', v_categories_created,
    'version', v_version,
    'item_ids', v_item_ids
  );
end;
$$;

grant execute on function public.publish_menu_ingestion(uuid, uuid, uuid) to authenticated, service_role;
