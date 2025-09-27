-- Supabase bootstrap schema for ICUPA Phase 0
-- Enables required extensions and creates foundational tables used across the diner shell.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.tenants (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    region text not null check (region in ('RW','EU')),
    created_at timestamptz not null default now()
);

create table if not exists public.locations (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    currency char(3) not null,
    timezone text not null,
    region text not null check (region in ('RW','EU')),
    created_at timestamptz not null default now()
);

create table if not exists public.items (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid not null references public.locations(id) on delete cascade,
    name text not null,
    description text,
    price_cents integer not null,
    currency char(3) not null,
    allergens text[] not null default '{}',
    tags text[] not null default '{}',
    created_at timestamptz not null default now()
);

create table if not exists public.orders (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid not null references public.locations(id) on delete cascade,
    status text not null default 'draft',
    subtotal_cents integer not null default 0,
    total_cents integer not null default 0,
    currency char(3) not null,
    created_at timestamptz not null default now()
);

create table if not exists public.agent_events (
    id uuid primary key default uuid_generate_v4(),
    agent_type text not null,
    session_id uuid,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- Helpful indexes for local testing
create index if not exists idx_locations_tenant on public.locations(tenant_id);
create index if not exists idx_items_location on public.items(location_id);
create index if not exists idx_orders_location on public.orders(location_id);
