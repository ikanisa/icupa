-- Phase 1 schema expansion and RLS hardening
set search_path = public;

-- Ensure required extensions for semantic search and scheduling
create extension if not exists "pgvector";
create extension if not exists "pg_trgm";
create extension if not exists "pg_stat_statements";
create extension if not exists "pg_cron";
create extension if not exists "pgmq";

-- Enumerated types for regionalisation, roles, and transactional state
create type region_t as enum ('RW','EU');
create type role_t as enum ('diner','owner','manager','cashier','server','chef','kds','auditor','support','admin');
create type order_status_t as enum ('draft','submitted','in_kitchen','ready','served','settled','voided');
create type payment_method_t as enum ('mtn_momo','airtel_money','stripe','adyen','cash','card_on_prem');
create type payment_status_t as enum ('pending','authorized','captured','failed','refunded');

-- Helper functions for policy checks
create or replace function public.current_table_session_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::jsonb->>'x-icupa-session','')::uuid;
$$;

create or replace function public.unit_embedding(index_position integer)
returns vector(3072)
language sql
stable
as $$
  select (
    select array_agg(case when g.i = index_position then 1::float4 else 0::float4 end order by g.i)::vector(3072)
    from generate_series(1, 3072) as g(i)
  );
$$;

-- Core identity tables
alter table public.tenants
  alter column region type region_t using region::region_t,
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid;

alter table public.locations
  alter column region type region_t using region::region_t,
  add column if not exists vat_rate numeric(5,2) default 0,
  add column if not exists settings jsonb not null default '{}'::jsonb;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  default_locale text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role role_t not null,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  primary key (user_id, tenant_id, role)
);

create or replace function public.is_staff_for_tenant(target_tenant uuid, allowed_roles role_t[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.tenant_id = target_tenant
      and ur.role = any(allowed_roles)
  );
$$;

-- Menu and catalogue
create table if not exists public.menus (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  is_active boolean not null default false,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.items
  add column if not exists menu_id uuid references public.menus(id) on delete cascade,
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists is_alcohol boolean not null default false,
  add column if not exists is_available boolean not null default true,
  add column if not exists media_url text,
  add column if not exists embedding vector(3072),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.modifier_groups (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.items(id) on delete cascade,
  name text not null,
  min_selections integer not null default 0,
  max_selections integer not null default 1,
  required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.modifiers (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  sku text not null,
  display_name text not null,
  quantity numeric not null default 0,
  par_level numeric not null default 0,
  lead_time_days integer default 2,
  track boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.item_ingredients (
  item_id uuid not null references public.items(id) on delete cascade,
  inventory_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric not null,
  primary key (item_id, inventory_id)
);

-- Table and session management
create table if not exists public.tables (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid not null references public.locations(id) on delete cascade,
  code text not null,
  seats integer not null default 2,
  qrtoken text not null,
  unique(location_id, code)
);

create table if not exists public.table_sessions (
  id uuid primary key default uuid_generate_v4(),
  table_id uuid not null references public.tables(id) on delete cascade,
  issued_for_ip inet,
  device_fingerprint text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Orders and payments
alter table public.orders
  add column if not exists table_id uuid references public.tables(id) on delete set null,
  add column if not exists table_session_id uuid references public.table_sessions(id) on delete set null,
  add column if not exists customer_id uuid references auth.users(id) on delete set null,
  add column if not exists tax_cents integer not null default 0,
  add column if not exists service_cents integer not null default 0,
  add column if not exists channel text not null default 'dine_in',
  alter column status type order_status_t using status::order_status_t;

create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid not null references public.items(id),
  quantity integer not null,
  unit_price_cents integer not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_item_mods (
  id uuid primary key default uuid_generate_v4(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  modifier_id uuid not null references public.modifiers(id),
  price_delta_cents integer not null
);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method payment_method_t not null,
  provider_ref text,
  status payment_status_t not null default 'pending',
  amount_cents integer not null,
  currency char(3) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  region region_t not null,
  fiscal_id text,
  url text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Agent and event telemetry
create table if not exists public.agent_sessions (
  id uuid primary key default uuid_generate_v4(),
  agent_type text not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  table_session_id uuid references public.table_sessions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_events
  add column if not exists session_id uuid references public.agent_sessions(id) on delete set null,
  add column if not exists agent_type text not null default 'waiter',
  add column if not exists input jsonb,
  add column if not exists output jsonb,
  add column if not exists tools_used text[],
  add column if not exists latency_ms integer,
  add column if not exists cost_usd numeric(10,4);

create table if not exists public.recommendation_impressions (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.agent_sessions(id) on delete set null,
  item_id uuid references public.items(id) on delete set null,
  rationale text,
  accepted boolean,
  shown_at timestamptz not null default now()
);

create table if not exists public.events (
  id bigserial primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  table_session_id uuid references public.table_sessions(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_locations_region on public.locations(region);
create index if not exists idx_items_menu on public.items(menu_id);
create index if not exists idx_items_embedding_ivfflat on public.items using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_orders_table_session on public.orders(table_session_id);
create index if not exists idx_orders_tenant_status on public.orders(tenant_id, status, created_at desc);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_agent_sessions_table on public.agent_sessions(table_session_id);
create index if not exists idx_events_tenant_created on public.events(tenant_id, created_at desc);

-- Row level security setup
alter table public.tenants enable row level security;
alter table public.locations enable row level security;
alter table public.menus enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.recommendation_impressions enable row level security;
alter table public.events enable row level security;

-- Policies for diners (table session)
create policy if not exists "Tenants readable by staff" on public.tenants for select using (
  is_staff_for_tenant(id, array['owner','manager','admin','support']::role_t[])
);

create policy if not exists "Locations readable public" on public.locations for select using (true);
create policy if not exists "Menus readable public" on public.menus for select using (true);
create policy if not exists "Categories readable public" on public.categories for select using (true);
create policy if not exists "Items readable public" on public.items for select using (is_available);

create policy if not exists "Insert orders via session" on public.orders
  for insert
  with check (
    table_session_id is not null
    and table_session_id = public.current_table_session_id()
  );

create policy if not exists "Diner select own order" on public.orders
  for select using (
    table_session_id is not null
    and table_session_id = public.current_table_session_id()
  );

create policy if not exists "Diner update own order" on public.orders
  for update using (
    table_session_id is not null
    and table_session_id = public.current_table_session_id()
    and status in ('draft','submitted')
  );

create policy if not exists "Order items follow parent order" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.table_session_id = public.current_table_session_id()
    )
  );

create policy if not exists "Order items insert by diner" on public.order_items
  for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.table_session_id = public.current_table_session_id()
        and o.status in ('draft','submitted')
    )
  );

create policy if not exists "Order items update by diner" on public.order_items
  for update using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.table_session_id = public.current_table_session_id()
        and o.status in ('draft','submitted')
    )
  );

create policy if not exists "Table sessions access by header" on public.table_sessions
  for select using (id = public.current_table_session_id());

create policy if not exists "Receipts visible to diners" on public.receipts
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = receipts.order_id
        and (
          o.table_session_id = public.current_table_session_id()
          or o.customer_id = auth.uid()
        )
    )
  );

-- Staff policies
create policy if not exists "Staff manage locations" on public.locations
  for all using (is_staff_for_tenant(tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[]));

create policy if not exists "Staff manage menus" on public.menus
  for all using (is_staff_for_tenant(tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[]));

create policy if not exists "Staff manage categories" on public.categories
  for all using (
    exists (
      select 1 from public.menus m
      where m.id = categories.menu_id
        and is_staff_for_tenant(m.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

create policy if not exists "Staff manage items" on public.items
  for all using (
    exists (
      select 1 from public.menus m
      where m.id = items.menu_id
        and is_staff_for_tenant(m.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

create policy if not exists "Staff manage tables" on public.tables
  for all using (
    exists (
      select 1 from public.locations l
      where l.id = tables.location_id
        and is_staff_for_tenant(l.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

create policy if not exists "Staff manage orders" on public.orders
  for all using (is_staff_for_tenant(tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[]));

create policy if not exists "Staff manage order items" on public.order_items
  for all using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

create policy if not exists "Staff manage payments" on public.payments
  for all using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','admin']::role_t[])
    )
  );

create policy if not exists "Staff manage receipts" on public.receipts
  for all using (
    exists (
      select 1 from public.orders o
      where o.id = receipts.order_id
        and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','admin']::role_t[])
    )
  );

create policy if not exists "Staff manage agent sessions" on public.agent_sessions
  for all using (
    is_staff_for_tenant(coalesce(tenant_id, (select tenant_id from public.locations where id = agent_sessions.location_id)), array['owner','manager','cashier','admin','support']::role_t[])
  );

create policy if not exists "Staff manage recommendation impressions" on public.recommendation_impressions
  for all using (
    exists (
      select 1 from public.agent_sessions s
      where s.id = recommendation_impressions.session_id
        and is_staff_for_tenant(coalesce(s.tenant_id, (select tenant_id from public.locations where id = s.location_id)), array['owner','manager','admin','support']::role_t[])
    )
  );

create policy if not exists "Staff view events" on public.events
  for select using (
    is_staff_for_tenant(coalesce(tenant_id, (select tenant_id from public.locations where id = events.location_id)), array['owner','manager','admin','support']::role_t[])
  );

-- Allow service role full access
grant usage on schema public to service_role;
