-- FinOps cost estimates for tracking primary infra cost drivers.
set search_path = public;

create schema if not exists fin;

-- Allow finance specific role assignments.
alter table if exists sec.user_roles
  drop constraint if exists user_roles_role_check;

alter table if exists sec.user_roles
  add constraint user_roles_role_check
  check (role in ('consumer', 'supplier', 'ops', 'admin', 'finance'));

create table if not exists fin.cost_estimates (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  category text not null check (category in ('llm_tokens', 'storage', 'egress')),
  label text not null,
  estimated_cents bigint not null check (estimated_cents >= 0),
  currency text not null default 'USD',
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  usage_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fin_cost_estimates_unique_month_category unique (month, category)
);

comment on table fin.cost_estimates is 'Monthly cost benchmarks for primary infra drivers surfaced to FinOps dashboards.';
comment on column fin.cost_estimates.category is 'Cost driver taxonomy aligned to FinOps dashboards (llm_tokens, storage, egress).';
comment on column fin.cost_estimates.confidence is 'Confidence interval for the estimate (low, medium, high).';

insert into fin.cost_estimates (month, category, label, estimated_cents, confidence, usage_notes)
values
  ('2025-02-01', 'llm_tokens', 'Claude autopilot + concierge prompts', 1285000, 'medium', '52M input/output tokens across concierge and ops pilot batches.'),
  ('2025-02-01', 'storage', 'Object storage buckets (invoices + media)', 685000, 'high', '9.1 TB stored across invoices/, supplier_media/ with 45 day retention.'),
  ('2025-02-01', 'egress', 'Supabase → Vercel API responses', 472000, 'medium', 'High read volume from concierge itineraries + nightly analytics exports.')
on conflict (month, category) do update
  set label = excluded.label,
      estimated_cents = excluded.estimated_cents,
      confidence = excluded.confidence,
      usage_notes = excluded.usage_notes,
      updated_at = timezone('utc', now());

alter table fin.cost_estimates enable row level security;

revoke all on fin.cost_estimates from anon;
revoke all on fin.cost_estimates from authenticated;

create policy fin_cost_estimates_service_role on fin.cost_estimates
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy fin_cost_estimates_finance_read on fin.cost_estimates
  for select
  using (sec.has_role('finance') or sec.has_role('admin'));

grant usage on schema fin to authenticated;
grant select on fin.cost_estimates to authenticated;
