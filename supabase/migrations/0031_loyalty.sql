create schema if not exists loyalty;

create table if not exists loyalty.accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references core.profiles(id) on delete cascade,
  tier text not null default 'starter',
  points_balance bigint not null default 0,
  last_awarded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists loyalty.ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references loyalty.accounts(id) on delete cascade,
  points_delta bigint not null,
  reason text not null,
  source text,
  itinerary_id uuid references booking.itineraries(id) on delete set null,
  promo_application_id uuid references pricing.applications(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  request_key text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_loyalty_ledger_account on loyalty.ledger(account_id);
create index if not exists idx_loyalty_ledger_itinerary on loyalty.ledger(itinerary_id);
create unique index if not exists idx_loyalty_ledger_request on loyalty.ledger(request_key) where request_key is not null;
