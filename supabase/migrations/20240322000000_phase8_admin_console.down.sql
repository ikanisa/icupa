set search_path = public, extensions;

drop trigger if exists trg_log_agent_runtime_configs on public.agent_runtime_configs;
drop function if exists public.log_agent_config_audit();

drop policy if exists "Staff manage tenant KPI snapshots" on public.tenant_kpi_snapshots;
drop policy if exists "Staff read tenant KPI snapshots" on public.tenant_kpi_snapshots;
drop table if exists public.tenant_kpi_snapshots cascade;

drop policy if exists "Staff manage compliance tasks" on public.compliance_tasks;
drop policy if exists "Staff read compliance tasks" on public.compliance_tasks;
drop table if exists public.compliance_tasks cascade;

drop policy if exists "Staff insert agent config audit" on public.agent_config_audit_events;
drop policy if exists "Staff read agent config audit" on public.agent_config_audit_events;
drop table if exists public.agent_config_audit_events cascade;

alter table if exists public.agent_runtime_configs
  drop column if exists instructions,
  drop column if exists tool_allowlist,
  drop column if exists autonomy_level,
  drop column if exists retrieval_ttl_minutes,
  drop column if exists experiment_flag,
  drop column if exists updated_by,
  drop column if exists sync_pending;

-- Restore touch trigger to basic behaviour
DROP TRIGGER IF EXISTS trg_touch_agent_runtime_configs ON public.agent_runtime_configs;
DROP FUNCTION IF EXISTS public.touch_agent_runtime_configs();

CREATE FUNCTION public.touch_agent_runtime_configs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_agent_runtime_configs
  BEFORE UPDATE ON public.agent_runtime_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_agent_runtime_configs();

drop type if exists public.autonomy_level_t;
drop type if exists public.compliance_status_t;
drop type if exists public.compliance_severity_t;
