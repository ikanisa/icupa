create or replace function public.agent_cleanup(
  p_session_days integer default 30,
  p_event_days integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  deleted_events bigint := 0;
  deleted_sessions bigint := 0;
  event_interval interval := make_interval(days => coalesce(p_event_days, 30));
  session_interval interval := make_interval(days => coalesce(p_session_days, 30));
begin
  delete from agents.events
  where created_at < now() - event_interval;
  get diagnostics deleted_events = row_count;

  delete from agents.sessions
  where updated_at < now() - session_interval;
  get diagnostics deleted_sessions = row_count;

  return jsonb_build_object(
    'deleted_events', deleted_events,
    'deleted_sessions', deleted_sessions,
    'event_cutoff', (now() - event_interval),
    'session_cutoff', (now() - session_interval)
  );
end;
$$;
