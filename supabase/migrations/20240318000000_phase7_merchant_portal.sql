set search_path = public, extensions;

-- Phase 7: Merchant portal tables and governance

-- Table state management ----------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'table_state_t') then
    create type public.table_state_t as enum (
      'vacant',
      'ordering',
      'in_kitchen',
      'served',
      'bill',
      'cleaning'
    );
  end if;
end;
$$;

alter table public.tables
  add column if not exists state table_state_t not null default 'vacant',
  add column if not exists layout jsonb not null default jsonb_build_object('x', 0, 'y', 0, 'width', 160, 'height', 160);

create table if not exists public.table_state_events (
  id uuid primary key default uuid_generate_v4(),
  table_id uuid not null references public.tables(id) on delete cascade,
  previous_state table_state_t,
  next_state table_state_t not null,
  notes text,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_table_state_events_table_created on public.table_state_events(table_id, created_at desc);

-- Menu copy review ----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'copy_review_status_t') then
    create type public.copy_review_status_t as enum ('pending', 'approved', 'rejected');
  end if;
end;
$$;

create table if not exists public.menu_copy_suggestions (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.items(id) on delete cascade,
  locale text not null,
  tone text,
  suggested_name text not null,
  suggested_description text not null,
  rationale text,
  status copy_review_status_t not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_reason text
);

create index if not exists idx_menu_copy_suggestions_item_status on public.menu_copy_suggestions(item_id, status);

-- Inventory automation controls --------------------------------------------
alter table public.inventory_items
  add column if not exists reorder_threshold numeric not null default 0,
  add column if not exists auto_86 boolean not null default false,
  add column if not exists auto_86_level text not null default 'L0';

-- Promo builder -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'promo_status_t') then
    create type public.promo_status_t as enum ('draft', 'pending_review', 'approved', 'active', 'paused', 'archived');
  end if;
end;
$$;

create table if not exists public.promo_campaigns (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  name text not null,
  description text,
  epsilon numeric(5,4) not null default 0.0500 check (epsilon >= 0 and epsilon <= 1),
  budget_cap_cents integer not null default 0 check (budget_cap_cents >= 0),
  spent_cents integer not null default 0 check (spent_cents >= 0),
  frequency_cap integer not null default 1 check (frequency_cap >= 0),
  fairness_constraints jsonb not null default '{}'::jsonb,
  status promo_status_t not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists idx_promo_campaigns_tenant_status on public.promo_campaigns(tenant_id, status, created_at desc);

create table if not exists public.promo_audit_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.promo_campaigns(id) on delete cascade,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_promo_audit_campaign_created on public.promo_audit_events(campaign_id, created_at desc);

-- Row level security --------------------------------------------------------
alter table public.table_state_events enable row level security;
alter table public.menu_copy_suggestions enable row level security;
alter table public.promo_campaigns enable row level security;
alter table public.promo_audit_events enable row level security;

drop policy if exists "Staff read table states" on public.table_state_events;
create policy "Staff read table states" on public.table_state_events
  for select using (
    exists (
      select 1 from public.tables t
      join public.locations l on l.id = t.location_id
      where t.id = table_state_events.table_id
        and is_staff_for_tenant(l.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

drop policy if exists "Staff insert table state events" on public.table_state_events;
create policy "Staff insert table state events" on public.table_state_events
  for insert with check (
    exists (
      select 1 from public.tables t
      join public.locations l on l.id = t.location_id
      where t.id = table_state_events.table_id
        and is_staff_for_tenant(l.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

drop policy if exists "Staff manage tables state" on public.tables;
create policy "Staff manage tables state" on public.tables
  for update using (
    exists (
      select 1 from public.locations l
      where l.id = tables.location_id
        and is_staff_for_tenant(l.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  ) with check (
    exists (
      select 1 from public.locations l
      where l.id = tables.location_id
        and is_staff_for_tenant(l.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

drop policy if exists "Staff review menu copy" on public.menu_copy_suggestions;
create policy "Staff review menu copy" on public.menu_copy_suggestions
  for all using (
    exists (
      select 1 from public.items i
      join public.menus m on m.id = i.menu_id
      where i.id = menu_copy_suggestions.item_id
        and is_staff_for_tenant(m.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

drop policy if exists "Staff manage promo campaigns" on public.promo_campaigns;
create policy "Staff manage promo campaigns" on public.promo_campaigns
  for all using (is_staff_for_tenant(tenant_id, array['owner','manager','cashier','admin']::role_t[]));

drop policy if exists "Staff manage promo audit" on public.promo_audit_events;
create policy "Staff manage promo audit" on public.promo_audit_events
  for all using (
    exists (
      select 1 from public.promo_campaigns c
      where c.id = promo_audit_events.campaign_id
        and is_staff_for_tenant(c.tenant_id, array['owner','manager','cashier','admin']::role_t[])
    )
  );
