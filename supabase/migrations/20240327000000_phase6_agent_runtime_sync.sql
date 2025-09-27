set search_path = public;

-- Allow the agents service to acknowledge runtime configuration syncs without
-- re-triggering the sync_pending flag.
create or replace function public.touch_agent_runtime_configs()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if coalesce(current_setting('app.agents_runtime_ack', true), 'false') = 'true' then
    new.sync_pending := false;
  else
    new.sync_pending := true;
  end if;
  if new.updated_by is null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.ack_agent_runtime_config(config_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the service role may acknowledge agent runtime configs.';
  end if;

  perform set_config('app.agents_runtime_ack', 'true', true);
  update public.agent_runtime_configs
     set sync_pending = false,
         updated_at = now()
   where id = config_id;
  perform set_config('app.agents_runtime_ack', 'false', true);
exception
  when others then
    perform set_config('app.agents_runtime_ack', 'false', true);
    raise;
end;
$$;

comment on function public.ack_agent_runtime_config(uuid) is
  'Marks the provided agent runtime configuration as synced by the agents service.';
