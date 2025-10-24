create or replace view public.agent_eval_runs_view as
select id, started_at, finished_at, label, total, passed, failed
from agents.eval_runs;

grant select on public.agent_eval_runs_view to authenticated;

grant select on public.agent_eval_runs_view to anon;

create or replace view public.agent_eval_cases_view as
select id, run_id, agent_key, input, expected, result, pass, duration_ms, created_at
from agents.eval_cases;

grant select on public.agent_eval_cases_view to authenticated;

grant select on public.agent_eval_cases_view to anon;

create or replace view public.agent_eval_scores_view as
select id, agent_key, metric, value, window_label, computed_at
from agents.eval_scores;

grant select on public.agent_eval_scores_view to authenticated;

grant select on public.agent_eval_scores_view to anon;

create or replace function public.agent_eval_create_run(
  p_label text
) returns agents.eval_runs
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  inserted agents.eval_runs;
begin
  insert into agents.eval_runs (label)
  values (p_label)
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.agent_eval_create_run(text) to authenticated;

grant execute on function public.agent_eval_create_run(text) to anon;

create or replace function public.agent_eval_insert_case(
  p_run uuid,
  p_agent text,
  p_input jsonb,
  p_expected jsonb,
  p_result jsonb,
  p_pass boolean,
  p_duration int
) returns agents.eval_cases
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  inserted agents.eval_cases;
begin
  insert into agents.eval_cases (run_id, agent_key, input, expected, result, pass, duration_ms)
  values (p_run, p_agent, p_input, p_expected, p_result, p_pass, p_duration)
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.agent_eval_insert_case(uuid, text, jsonb, jsonb, jsonb, boolean, int)
  to authenticated;

grant execute on function public.agent_eval_insert_case(uuid, text, jsonb, jsonb, jsonb, boolean, int)
  to anon;

create or replace function public.agent_eval_finalize_run(
  p_run uuid,
  p_total int,
  p_passed int,
  p_failed int
) returns agents.eval_runs
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  updated agents.eval_runs;
begin
  update agents.eval_runs
     set finished_at = now(),
         total = p_total,
         passed = p_passed,
         failed = p_failed
   where id = p_run
  returning * into updated;
  return updated;
end;
$$;

grant execute on function public.agent_eval_finalize_run(uuid, int, int, int) to authenticated;

grant execute on function public.agent_eval_finalize_run(uuid, int, int, int) to anon;

create or replace function public.agent_eval_insert_score(
  p_agent text,
  p_metric text,
  p_value numeric,
  p_window text,
  p_computed timestamptz
) returns agents.eval_scores
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  inserted agents.eval_scores;
begin
  insert into agents.eval_scores (agent_key, metric, value, window_label, computed_at)
  values (p_agent, p_metric, p_value, coalesce(p_window, 'last_7d'), coalesce(p_computed, now()))
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.agent_eval_insert_score(text, text, numeric, text, timestamptz)
  to authenticated;

grant execute on function public.agent_eval_insert_score(text, text, numeric, text, timestamptz)
  to anon;
