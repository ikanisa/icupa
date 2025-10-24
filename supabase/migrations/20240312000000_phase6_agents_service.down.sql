set search_path = public, extensions;

alter table if exists public.agent_events
  drop column if exists tenant_id,
  drop column if exists location_id,
  drop column if exists table_session_id;

drop index if exists public.idx_agent_events_tenant;
drop index if exists public.idx_agent_events_session;

alter table if exists public.recommendation_impressions
  drop column if exists tenant_id,
  drop column if exists location_id;

drop index if exists public.idx_reco_impressions_tenant;

drop trigger if exists trg_touch_agent_runtime_configs on public.agent_runtime_configs;
drop function if exists public.touch_agent_runtime_configs();
drop policy if exists "Allow service role to manage agent runtime configs" on public.agent_runtime_configs;
drop policy if exists "Staff manage agent runtime configs" on public.agent_runtime_configs;
drop policy if exists "Staff read agent runtime configs" on public.agent_runtime_configs;
drop table if exists public.agent_runtime_configs cascade;
