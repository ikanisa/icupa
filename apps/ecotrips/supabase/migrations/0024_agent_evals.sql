create schema if not exists agents;

create table if not exists agents.eval_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  label text,
  total int not null default 0,
  passed int not null default 0,
  failed int not null default 0
);

create table if not exists agents.eval_cases (
  id bigserial primary key,
  run_id uuid not null references agents.eval_runs(id) on delete cascade,
  agent_key text not null,
  input jsonb,
  expected jsonb,
  result jsonb,
  pass boolean,
  duration_ms int,
  created_at timestamptz not null default now()
);

create table if not exists agents.eval_scores (
  id bigserial primary key,
  agent_key text not null,
  metric text not null,
  value numeric not null,
  window_label text not null default 'last_7d',
  computed_at timestamptz not null default now()
);

alter table agents.eval_runs enable row level security;
alter table agents.eval_cases enable row level security;
alter table agents.eval_scores enable row level security;

create policy p_eval_runs_service on agents.eval_runs
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy p_eval_cases_service on agents.eval_cases
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy p_eval_scores_service on agents.eval_scores
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
