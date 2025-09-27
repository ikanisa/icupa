begin;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

DO $$
DECLARE
  before_count integer;
  after_count integer;
  sync_flag boolean;
  config_id uuid;
  after_ack boolean;
BEGIN
  select count(*)
    into before_count
    from public.agent_config_audit_events
   where tenant_id = '00000000-0000-4000-8000-000000000001'
     and agent_type = 'waiter';

  update public.agent_runtime_configs
     set instructions = 'Respond with brand voice and cite receipts.',
         tool_allowlist = ARRAY['get_menu','check_allergens','recommend_items'],
         autonomy_level = 'L1',
         session_budget_usd = 0.95,
         daily_budget_usd = 60,
         retrieval_ttl_minutes = 7,
         experiment_flag = 'phase8-regression'
   where tenant_id = '00000000-0000-4000-8000-000000000001'
     and agent_type = 'waiter'
  returning id, sync_pending into config_id, sync_flag;

  if sync_flag is false then
    raise exception 'Expected agent config sync flag to be set after update';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform public.ack_agent_runtime_config(config_id);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);

  select sync_pending
    into after_ack
    from public.agent_runtime_configs
   where id = config_id;

  if after_ack then
    raise exception 'Expected ack to clear sync_pending flag';
  end if;

  select count(*)
    into after_count
    from public.agent_config_audit_events
   where tenant_id = '00000000-0000-4000-8000-000000000001'
     and agent_type = 'waiter';

  if after_count <= before_count then
    raise exception 'Agent config audit events should record updates';
  end if;

  if not exists (
    select 1
      from public.compliance_tasks
     where tenant_id = '00000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Expected compliance tasks seeded for tenant';
  end if;

  if not exists (
    select 1
      from public.tenant_kpi_snapshots
     where tenant_id = '00000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Expected KPI snapshot rows for tenant';
  end if;
END $$;

set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';

DO $$
BEGIN
  begin
    update public.agent_runtime_configs
       set autonomy_level = 'L2'
     where tenant_id = '00000000-0000-4000-8000-000000000001'
       and agent_type = 'waiter';
    raise exception 'Expected diner update to be blocked by RLS';
  exception
    when others then
      return;
  end;
END $$;

rollback;
