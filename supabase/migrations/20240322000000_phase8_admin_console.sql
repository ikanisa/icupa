set search_path = public, extensions;

-- Phase 8 – Admin console tables, policies, and agent configuration governance

do $$
begin
  if not exists (select 1 from pg_type where typname = 'autonomy_level_t') then
    create type public.autonomy_level_t as enum ('L0', 'L1', 'L2', 'L3');
  end if;
end;
$$;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_status_t') then
    create type public.compliance_status_t as enum ('pending', 'in_progress', 'blocked', 'resolved');
  end if;
end;
$$;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_severity_t') then
    create type public.compliance_severity_t as enum ('low', 'medium', 'high', 'critical');
  end if;
end;
$$;

alter table public.agent_runtime_configs
  add column if not exists instructions text not null default 'Follow tenant brand guardrails and cite sources.',
  add column if not exists tool_allowlist text[] not null default '{}',
  add column if not exists autonomy_level autonomy_level_t not null default 'L0',
  add column if not exists retrieval_ttl_minutes integer not null default 5 check (retrieval_ttl_minutes > 0),
  add column if not exists experiment_flag text,
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists sync_pending boolean not null default true;

create table if not exists public.agent_config_audit_events (
  id uuid primary key default uuid_generate_v4(),
  config_id uuid not null references public.agent_runtime_configs(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  agent_type text not null,
  action text not null,
  before_state jsonb,
  after_state jsonb not null,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_config_audit_events_config on public.agent_config_audit_events(config_id, created_at desc);
create index if not exists idx_agent_config_audit_events_tenant on public.agent_config_audit_events(tenant_id, created_at desc);

create table if not exists public.compliance_tasks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  region region_t not null,
  category text not null,
  title text not null,
  status compliance_status_t not null default 'pending',
  severity compliance_severity_t not null default 'medium',
  due_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_compliance_tasks_tenant on public.compliance_tasks(tenant_id, status, severity);

create table if not exists public.tenant_kpi_snapshots (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  time_window text not null default '7d',
  captured_at timestamptz not null default now(),
  gmv_cents bigint not null default 0,
  aov_cents bigint not null default 0,
  attach_rate numeric(6,3) not null default 0,
  prep_sla_p95_minutes numeric(6,2) not null default 0,
  ai_acceptance_rate numeric(6,3) not null default 0,
  safety_blocks integer not null default 0
);

create index if not exists idx_tenant_kpi_snapshots_recent on public.tenant_kpi_snapshots(tenant_id, captured_at desc);

alter table public.agent_runtime_configs enable row level security;
alter table public.agent_config_audit_events enable row level security;
alter table public.compliance_tasks enable row level security;
alter table public.tenant_kpi_snapshots enable row level security;

drop policy if exists "Staff read agent config audit" on public.agent_config_audit_events;
create policy "Staff read agent config audit" on public.agent_config_audit_events
  for select using (
    tenant_id is null
    or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

drop policy if exists "Staff insert agent config audit" on public.agent_config_audit_events;
create policy "Staff insert agent config audit" on public.agent_config_audit_events
  for insert with check (
    tenant_id is null
    or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

drop policy if exists "Staff read compliance tasks" on public.compliance_tasks;
create policy "Staff read compliance tasks" on public.compliance_tasks
  for select using (tenant_id is null or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[]));

drop policy if exists "Staff manage compliance tasks" on public.compliance_tasks;
create policy "Staff manage compliance tasks" on public.compliance_tasks
  for all using (tenant_id is not null and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[]))
  with check (tenant_id is not null and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[]));

drop policy if exists "Staff read tenant KPI snapshots" on public.tenant_kpi_snapshots;
create policy "Staff read tenant KPI snapshots" on public.tenant_kpi_snapshots
  for select using (is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[]));

drop policy if exists "Staff manage tenant KPI snapshots" on public.tenant_kpi_snapshots;
create policy "Staff manage tenant KPI snapshots" on public.tenant_kpi_snapshots
  for all using (is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[]))
  with check (is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[]));

create or replace function public.touch_agent_runtime_configs()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.sync_pending = true;
  if new.updated_by is null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.log_agent_config_audit()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
  previous jsonb;
begin
  actor := coalesce(new.updated_by, auth.uid());
  if tg_op = 'UPDATE' then
    previous := to_jsonb(old);
  else
    previous := null;
  end if;

  insert into public.agent_config_audit_events (config_id, tenant_id, agent_type, action, before_state, after_state, changed_by)
  values (
    new.id,
    new.tenant_id,
    new.agent_type,
    lower(tg_op),
    previous,
    to_jsonb(new),
    actor
  );

  return new;
end;
$$;

drop trigger if exists trg_touch_agent_runtime_configs on public.agent_runtime_configs;
drop trigger if exists trg_log_agent_runtime_configs on public.agent_runtime_configs;

create trigger trg_touch_agent_runtime_configs
  before insert or update on public.agent_runtime_configs
  for each row
  execute function public.touch_agent_runtime_configs();

create trigger trg_log_agent_runtime_configs
  after insert or update on public.agent_runtime_configs
  for each row
  execute function public.log_agent_config_audit();
