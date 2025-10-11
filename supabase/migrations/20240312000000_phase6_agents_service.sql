-- Phase 6 – Agents service runtime configuration and telemetry enrichments

set search_path = public, extensions;

-- Extend agent_events with tenant/location context for budgeting and analytics
alter table if exists public.agent_events
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists location_id uuid references public.locations(id) on delete set null,
  add column if not exists table_session_id uuid references public.table_sessions(id) on delete set null;

create index if not exists idx_agent_events_tenant on public.agent_events(tenant_id, agent_type, created_at desc);
create index if not exists idx_agent_events_session on public.agent_events(session_id);

-- Add tenant/location context to recommendation impressions for downstream analytics
alter table if exists public.recommendation_impressions
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists idx_reco_impressions_tenant on public.recommendation_impressions(tenant_id, shown_at desc);

-- Runtime configuration table powering agent kill switches and budgets
create table if not exists public.agent_runtime_configs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  agent_type text not null,
  enabled boolean not null default true,
  session_budget_usd numeric(10,4) not null default 0.75,
  daily_budget_usd numeric(10,4) not null default 50,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_agent_runtime_configs_unique
  on public.agent_runtime_configs(tenant_id, agent_type);

create unique index if not exists idx_agent_runtime_configs_global_unique
  on public.agent_runtime_configs(agent_type)
  where tenant_id is null;

alter table public.agent_runtime_configs enable row level security;

create or replace function public.touch_agent_runtime_configs()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_agent_runtime_configs
  before update on public.agent_runtime_configs
  for each row
  execute function public.touch_agent_runtime_configs();

-- RLS policies: staff with admin/support roles can manage tenant rows; service-role bypasses policies
drop policy if exists "Staff read agent runtime configs" on public.agent_runtime_configs;
create policy "Staff read agent runtime configs"
  on public.agent_runtime_configs
  for select
  using (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

drop policy if exists "Staff manage agent runtime configs" on public.agent_runtime_configs;
create policy "Staff manage agent runtime configs"
  on public.agent_runtime_configs
  for all using (
    tenant_id is not null
    and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  )
  with check (
    tenant_id is not null
    and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

-- Ensure service role can insert global defaults explicitly
drop policy if exists "Allow service role to manage agent runtime configs" on public.agent_runtime_configs;
create policy "Allow service role to manage agent runtime configs"
  on public.agent_runtime_configs
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
