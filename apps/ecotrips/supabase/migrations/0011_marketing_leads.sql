create table if not exists public.marketing_leads (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  name text not null,
  email text not null,
  travel_month text,
  group_type text,
  message text,
  consent_captured boolean not null default false,
  source text not null default 'marketing_site'
);

alter table public.marketing_leads enable row level security;

revoke all on public.marketing_leads from anon;
revoke all on public.marketing_leads from authenticated;

comment on table public.marketing_leads is 'Leads captured from ecoTrips marketing properties.';
