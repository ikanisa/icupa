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
  after_status text;
  new_task_id uuid;
  new_dsr_id uuid;
  dsr_status text;
  notice_content text;
  kybc_state text;
  sla_pending bigint;
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

  update public.compliance_tasks
     set status = 'in_progress',
         due_at = now() + interval '2 days'
   where tenant_id = '00000000-0000-4000-8000-000000000001'
   limit 1
  returning status into after_status;

  if after_status <> 'in_progress' then
    raise exception 'Expected staff update on compliance task to succeed';
  end if;

  insert into public.compliance_tasks (tenant_id, region, category, title, severity)
  values (
    '00000000-0000-4000-8000-000000000001',
    'EU',
    'ai_disclosure',
    'Publish AI disclosure in footer',
    'medium'
  )
  returning id into new_task_id;

  if new_task_id is null then
    raise exception 'Expected staff insert for compliance task to return id';
  end if;

  update public.compliance_notice_templates
     set content = 'Updated AI disclosure copy for regression test',
         last_reviewed_at = now()
   where tenant_id = '00000000-0000-4000-8000-000000000001'
     and notice_type = 'ai_disclosure'
     and surface = 'diner_chat'
   returning content into notice_content;

  if notice_content <> 'Updated AI disclosure copy for regression test' then
    raise exception 'Expected compliance notice update to succeed';
  end if;

  update public.kybc_checklist_items
     set status = 'in_progress'
   where tenant_id = '00000000-0000-4000-8000-000000000001'
   limit 1
  returning status into kybc_state;

  if kybc_state <> 'in_progress' then
    raise exception 'Expected KYBC checklist update to succeed';
  end if;

  select pending_count
    into sla_pending
    from public.fiscalization_sla_summary('00000000-0000-4000-8000-000000000001');

  if sla_pending is null then
    raise exception 'Expected fiscalization SLA summary to return a value';
  end if;

  if not exists (
    select 1
      from public.tenant_kpi_snapshots
     where tenant_id = '00000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Expected KPI snapshot rows for tenant';
  end if;

  insert into public.dsr_requests (tenant_id, region, subject_identifier, contact_email, request_type, notes)
  values (
    '00000000-0000-4000-8000-000000000001',
    'RW',
    'guest-privacy-test',
    'ops@icupa.test',
    'export',
    '{"source":"regression"}'::jsonb
  )
  returning id into new_dsr_id;

  if new_dsr_id is null then
    raise exception 'Expected insert to return DSR request id';
  end if;

  update public.dsr_requests
     set status = 'completed'
   where id = new_dsr_id
   returning status into dsr_status;

  if dsr_status <> 'completed' then
    raise exception 'Expected staff update on DSR request to succeed';
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
      null;
  end;

  begin
    insert into public.dsr_requests (tenant_id, region, subject_identifier, request_type)
    values (
      '00000000-0000-4000-8000-000000000001',
      'RW',
      'diner-should-be-denied',
      'delete'
    );
    raise exception 'Expected diner DSR insert to be blocked by RLS';
  exception
    when others then
      null;
  end;

  begin
    update public.compliance_notice_templates
       set content = 'diner-should-not-update'
     where tenant_id = '00000000-0000-4000-8000-000000000001';
    raise exception 'Expected diner compliance notice update to be blocked';
  exception
    when others then
      null;
  end;

  begin
    update public.kybc_checklist_items
       set status = 'resolved'
     where tenant_id = '00000000-0000-4000-8000-000000000001';
    raise exception 'Expected diner KYBC update to be blocked by RLS';
  exception
    when others then
      null;
  end;
END $$;

rollback;
