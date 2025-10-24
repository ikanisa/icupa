create schema if not exists pricing;

create table if not exists pricing.rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  kind text not null check (kind in (
    'percentage',
    'fixed_amount',
    'loyalty_multiplier'
  )),
  value numeric(10,4) not null,
  currency text,
  max_redemptions int,
  per_user_limit int default 1,
  starts_at timestamptz,
  ends_at timestamptz,
  conditions jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists pricing.applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references core.profiles(id) on delete set null,
  itinerary_id uuid references booking.itineraries(id) on delete set null,
  rule_id uuid references pricing.rules(id) on delete set null,
  promo_code text not null,
  base_total_cents bigint not null,
  discount_cents bigint not null default 0,
  currency text not null default 'USD',
  breakdown jsonb default '{}'::jsonb,
  request_key text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_pricing_applications_profile on pricing.applications(profile_id);
create index if not exists idx_pricing_applications_itinerary on pricing.applications(itinerary_id);
create index if not exists idx_pricing_applications_rule on pricing.applications(rule_id);
create unique index if not exists idx_pricing_applications_request on pricing.applications(request_key) where request_key is not null;
