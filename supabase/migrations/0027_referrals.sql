create schema if not exists growth;

create table if not exists growth.referral_invitations (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  invitee_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  status text not null default 'pending',
  idempotency_key text,
  sent_via text[] not null default array['email'],
  last_sent_at timestamptz,
  consent_captured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

comment on table growth.referral_invitations is 'Referral invitations issued by travellers to invite their network.';
comment on column growth.referral_invitations.status is 'pending | accepted | expired | revoked';

create unique index if not exists referral_invitations_code_idx
  on growth.referral_invitations(referral_code);
create unique index if not exists referral_invitations_idempotency_idx
  on growth.referral_invitations(idempotency_key)
  where idempotency_key is not null;
create index if not exists referral_invitations_inviter_idx
  on growth.referral_invitations(inviter_user_id, created_at desc);

alter table growth.referral_invitations enable row level security;

create policy p_referral_invitations_service_only on growth.referral_invitations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists growth.referral_balances (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references auth.users(id) on delete cascade,
  available_cents bigint not null default 0,
  pending_cents bigint not null default 0,
  currency text not null default 'USD',
  lifetime_referred int not null default 0,
  lifetime_rewards_cents bigint not null default 0
);

comment on table growth.referral_balances is 'Aggregate referral balances for each traveller.';

create unique index if not exists referral_balances_user_idx
  on growth.referral_balances(user_id);

alter table growth.referral_balances enable row level security;

create policy p_referral_balances_service_only on growth.referral_balances
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists growth.reward_ledger (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references auth.users(id) on delete cascade,
  referral_invitation_id uuid references growth.referral_invitations(id) on delete set null,
  source text not null,
  amount_cents bigint not null,
  currency text not null default 'USD',
  status text not null default 'pending',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb
);

comment on table growth.reward_ledger is 'Line-item ledger for referral and growth rewards.';
comment on column growth.reward_ledger.status is 'pending | granted | cancelled | expired';

create index if not exists reward_ledger_user_idx
  on growth.reward_ledger(user_id, created_at desc);
create unique index if not exists reward_ledger_idempotency_idx
  on growth.reward_ledger(idempotency_key)
  where idempotency_key is not null;

alter table growth.reward_ledger enable row level security;

create policy p_reward_ledger_service_only on growth.reward_ledger
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists growth.price_lock_offers (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  itinerary_id uuid references itinerary.itineraries(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  hold_reference text,
  hold_expires_at timestamptz,
  price_cents bigint not null,
  currency text not null default 'USD',
  status text not null default 'issued',
  consent_captured_at timestamptz,
  idempotency_key text,
  telemetry jsonb not null default '{}'::jsonb
);

comment on table growth.price_lock_offers is 'Price lock offers surfaced to travellers including hold telemetry.';
comment on column growth.price_lock_offers.status is 'issued | accepted | expired | cancelled';

create index if not exists price_lock_offers_user_idx
  on growth.price_lock_offers(user_id, created_at desc);
create index if not exists price_lock_offers_itinerary_idx
  on growth.price_lock_offers(itinerary_id);
create unique index if not exists price_lock_offers_idempotency_idx
  on growth.price_lock_offers(idempotency_key)
  where idempotency_key is not null;

alter table growth.price_lock_offers enable row level security;

create policy p_price_lock_offers_service_only on growth.price_lock_offers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists growth.price_lock_events (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  offer_id uuid not null references growth.price_lock_offers(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb
);

comment on table growth.price_lock_events is 'Event stream for price lock offer telemetry.';

create index if not exists price_lock_events_offer_idx
  on growth.price_lock_events(offer_id, created_at desc);

alter table growth.price_lock_events enable row level security;

create policy p_price_lock_events_service_only on growth.price_lock_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists growth.disruption_board (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  itinerary_id uuid references itinerary.itineraries(id) on delete set null,
  disruption_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

comment on table growth.disruption_board is 'Operational disruption records powering proactive outreach and rebooking.';

create index if not exists disruption_board_itinerary_idx
  on growth.disruption_board(itinerary_id);
create index if not exists disruption_board_status_idx
  on growth.disruption_board(status, created_at desc);

alter table growth.disruption_board enable row level security;

create policy p_disruption_board_service_only on growth.disruption_board
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists growth.rebook_suggestions (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  disruption_id uuid references growth.disruption_board(id) on delete cascade,
  itinerary_id uuid references itinerary.itineraries(id) on delete set null,
  suggestion jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb
);

comment on table growth.rebook_suggestions is 'Recommended rebooking options for disrupted itineraries.';

create index if not exists rebook_suggestions_disruption_idx
  on growth.rebook_suggestions(disruption_id, created_at desc);
create unique index if not exists rebook_suggestions_idempotency_idx
  on growth.rebook_suggestions(idempotency_key)
  where idempotency_key is not null;

alter table growth.rebook_suggestions enable row level security;

create policy p_rebook_suggestions_service_only on growth.rebook_suggestions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
