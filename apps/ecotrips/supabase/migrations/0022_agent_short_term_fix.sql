create or replace function public.agent_append_memory(
  p_session uuid,
  p_scope text,
  p_entry jsonb
) returns agents.memory
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  existing agents.memory;
  combined jsonb;
begin
  if p_scope not in ('short_term','working_plan','long_term','team_memory') then
    raise exception 'invalid memory scope';
  end if;

  select * into existing
  from agents.memory
  where session_id = p_session
    and scope = p_scope
  for update;

  if not found then
    if p_scope = 'short_term' then
      insert into agents.memory (session_id, scope, content)
      values (p_session, p_scope, jsonb_build_array(coalesce(p_entry, '{}'::jsonb)))
      returning * into existing;
      return existing;
    else
      insert into agents.memory (session_id, scope, content)
      values (p_session, p_scope, coalesce(p_entry, '{}'::jsonb))
      returning * into existing;
      return existing;
    end if;
  end if;

  if p_scope = 'short_term' then
    combined = coalesce(existing.content, '[]'::jsonb);
    if jsonb_typeof(combined) != 'array' then
      combined = '[]'::jsonb;
    end if;
    if p_entry is not null then
      combined = combined || jsonb_build_array(p_entry);
    end if;
    combined = agents.truncate_short_term(combined, 40);
    update agents.memory
       set content = combined,
           updated_at = now()
     where id = existing.id
    returning * into existing;
    return existing;
  else
    update agents.memory
       set content = coalesce(p_entry, '{}'::jsonb),
           updated_at = now()
     where id = existing.id
    returning * into existing;
    return existing;
  end if;
end;
$$;
