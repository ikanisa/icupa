set search_path = public;

-- Summarise agent spend and run counts for admin cost dashboards.
create or replace function public.agent_cost_summary(
  p_tenant_id uuid,
  p_window_days integer default 30
)
returns table (
  agent_type text,
  runs_24h bigint,
  spend_24h_usd numeric,
  runs_7d bigint,
  spend_7d_usd numeric,
  runs_window bigint,
  spend_window_usd numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  can_access boolean;
begin
  if auth.role() = 'service_role' then
    can_access := true;
  elsif p_tenant_id is null then
    raise exception using message = 'Tenant scope is required for agent cost summary.', errcode = '42501';
  else
    can_access := is_staff_of(
      p_tenant_id,
      array['owner','manager','cashier','server','chef','kds','support','admin']::role_t[]
    );
  end if;

  if not can_access then
    raise exception using message = 'You do not have permission to view agent spend for this tenant.', errcode = '42501';
  end if;

  return query
  select
    e.agent_type,
    count(*) filter (where e.created_at >= now() - interval '24 hours')::bigint as runs_24h,
    coalesce(sum(e.cost_usd) filter (where e.created_at >= now() - interval '24 hours'), 0)::numeric as spend_24h_usd,
    count(*) filter (where e.created_at >= now() - interval '7 days')::bigint as runs_7d,
    coalesce(sum(e.cost_usd) filter (where e.created_at >= now() - interval '7 days'), 0)::numeric as spend_7d_usd,
    count(*) filter (where e.created_at >= now() - make_interval(days => greatest(p_window_days, 1)))::bigint as runs_window,
    coalesce(sum(e.cost_usd) filter (where e.created_at >= now() - make_interval(days => greatest(p_window_days, 1))), 0)::numeric as spend_window_usd
  from public.agent_events e
  where (p_tenant_id is null and e.tenant_id is null) or e.tenant_id = p_tenant_id
  group by e.agent_type
  order by e.agent_type;
end;
$$;

comment on function public.agent_cost_summary(uuid, integer) is
  'Returns aggregate spend and run counts per agent for the requested tenant scope.';

grant execute on function public.agent_cost_summary(uuid, integer) to authenticated;
