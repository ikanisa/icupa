-- Create table for agent performance snapshots
create table if not exists public.agent_performance_snapshots (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  agent_type text not null,
  time_window text not null default '24h',
  success_rate numeric not null default 0,
  tool_success_rate numeric not null default 0,
  avg_latency_ms integer not null default 0,
  avg_tokens integer not null default 0,
  run_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.agent_performance_snapshots is 'Aggregated performance metrics for AI agent runs.';
comment on column public.agent_performance_snapshots.success_rate is 'Successful run rate stored as 0-1 decimal.';
comment on column public.agent_performance_snapshots.tool_success_rate is 'Tool execution success rate stored as 0-1 decimal.';

create index if not exists idx_agent_performance_tenant
  on public.agent_performance_snapshots(tenant_id, agent_type, created_at desc);

alter table public.agent_performance_snapshots enable row level security;

drop policy if exists "Staff read agent performance" on public.agent_performance_snapshots;
create policy "Staff read agent performance"
  on public.agent_performance_snapshots
  for select using (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

drop policy if exists "Service role manage agent performance" on public.agent_performance_snapshots;
create policy "Service role manage agent performance"
  on public.agent_performance_snapshots
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Create table for websearch telemetry
create table if not exists public.websearch_queries (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  agent_type text,
  query text not null,
  results jsonb not null default '[]'::jsonb,
  latency_ms integer,
  source text default 'duckduckgo',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table public.websearch_queries is 'Audit log of agent websearch usage and returned snippets.';

create index if not exists idx_websearch_queries_tenant
  on public.websearch_queries(tenant_id, created_at desc);

alter table public.websearch_queries enable row level security;

drop policy if exists "Staff view websearch queries" on public.websearch_queries;
create policy "Staff view websearch queries"
  on public.websearch_queries
  for select using (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

drop policy if exists "Service role manage websearch queries" on public.websearch_queries;
create policy "Service role manage websearch queries"
  on public.websearch_queries
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
