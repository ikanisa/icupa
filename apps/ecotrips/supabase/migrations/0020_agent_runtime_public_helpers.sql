create or replace view public.agent_sessions_view as
select id, user_id, agent_key, created_at, updated_at
from agents.sessions;

grant select on public.agent_sessions_view to authenticated;

grant select on public.agent_sessions_view to anon;

create or replace view public.agent_memory_view as
select id, session_id, scope, content, updated_at
from agents.memory;

grant select on public.agent_memory_view to authenticated;

grant select on public.agent_memory_view to anon;

create or replace view public.agent_events_view as
select id, session_id, level, event, payload, created_at
from agents.events;

grant select on public.agent_events_view to authenticated;

grant select on public.agent_events_view to anon;

create or replace function public.agent_create_session(
  p_user uuid,
  p_agent text
) returns agents.sessions
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  inserted agents.sessions;
begin
  insert into agents.sessions (user_id, agent_key)
  values (p_user, p_agent)
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.agent_create_session(uuid, text) to authenticated;

grant execute on function public.agent_create_session(uuid, text) to anon;

create or replace function public.agent_get_session(
  p_id uuid
) returns agents.sessions
language sql
security definer
set search_path = agents, public
as $$
  select * from agents.sessions where id = p_id;
$$;

grant execute on function public.agent_get_session(uuid) to authenticated;

grant execute on function public.agent_get_session(uuid) to anon;

create or replace function public.agent_upsert_memory(
  p_session uuid,
  p_scope text,
  p_content jsonb
) returns agents.memory
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  existing agents.memory;
begin
  select * into existing
  from agents.memory
  where session_id = p_session and scope = p_scope
  for update;

  if found then
    update agents.memory
       set content = coalesce(p_content, '{}'::jsonb),
           updated_at = now()
     where id = existing.id
    returning * into existing;
    return existing;
  else
    insert into agents.memory (session_id, scope, content)
    values (p_session, p_scope, coalesce(p_content, '{}'::jsonb))
    returning * into existing;
    return existing;
  end if;
end;
$$;

grant execute on function public.agent_upsert_memory(uuid, text, jsonb) to authenticated;

grant execute on function public.agent_upsert_memory(uuid, text, jsonb) to anon;

create or replace function public.agent_insert_event(
  p_session uuid,
  p_level text,
  p_event text,
  p_payload jsonb
) returns agents.events
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  inserted agents.events;
begin
  insert into agents.events (session_id, level, event, payload)
  values (p_session, p_level, p_event, coalesce(p_payload, '{}'::jsonb))
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.agent_insert_event(uuid, text, text, jsonb) to authenticated;

grant execute on function public.agent_insert_event(uuid, text, text, jsonb) to anon;
