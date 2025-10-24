-- Same as in the job; provided here for reference or manual apply
create schema if not exists core;
create schema if not exists catalog;
create schema if not exists booking;
create schema if not exists payment;
create schema if not exists "group";
create schema if not exists audit;

create table if not exists core.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  persona text check (persona in ('consumer','supplier','ops')) default 'consumer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists "group".groups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null,
  name text,
  size_target int check (size_target > 0),
  discount_tiers jsonb default '[]'::jsonb,
  status text check (status in ('draft','open','locked','cancelled','completed')) default 'open',
  created_at timestamptz default now()
);

create table if not exists booking.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  group_id uuid,
  currency text default 'USD',
  total_cents bigint default 0,
  status text check (status in ('draft','quoted','booked','cancelled')) default 'draft',
  created_at timestamptz default now()
);

create table if not exists booking.items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references booking.itineraries(id) on delete cascade,
  item_type text check (item_type in ('hotel','tour','transfer','permit','other')),
  supplier_ref text,
  start_at timestamptz,
  end_at timestamptz,
  pax jsonb default '[]'::jsonb,
  price_cents bigint default 0,
  currency text default 'USD'
);

create table if not exists payment.payments (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references booking.itineraries(id) on delete set null,
  intent_id text unique,
  amount_cents bigint not null,
  currency text default 'USD',
  provider text default 'stripe',
  status text check (status in ('requires_action','processing','succeeded','failed','refunded','voided')) default 'processing',
  idempotency_key text,
  created_at timestamptz default now()
);

create table if not exists audit.events (
  id bigserial primary key,
  who uuid,
  what text not null,
  payload jsonb,
  created_at timestamptz default now()
);
