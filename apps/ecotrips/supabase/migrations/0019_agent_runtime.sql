create schema if not exists agents;

create table if not exists agents.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  agent_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agents.memory (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references agents.sessions(id) on delete cascade,
  scope text not null check (scope in ('short_term','working_plan','long_term','team_memory')),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists agents.events (
  id bigserial primary key,
  session_id uuid not null references agents.sessions(id) on delete cascade,
  level text not null check (level in ('AUDIT','INFO','WARN','ERROR')),
  event text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create or replace function agents.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_agents_sessions_updated
  before update on agents.sessions
  for each row
  execute function agents.set_updated_at();

create trigger trg_agents_memory_updated
  before update on agents.memory
  for each row
  execute function agents.set_updated_at();

alter table agents.sessions enable row level security;
alter table agents.memory enable row level security;
alter table agents.events enable row level security;

create policy p_sessions_access_self on agents.sessions
  for select using (
    user_id is null
    or auth.role() = 'service_role'
    or auth.uid() = user_id
  );

create policy p_sessions_insert_self on agents.sessions
  for insert with check (
    user_id is null
    or auth.role() = 'service_role'
    or auth.uid() = user_id
  );

create policy p_sessions_update_self on agents.sessions
  for update using (
    auth.role() = 'service_role'
    or auth.uid() = user_id
  )
  with check (
    auth.role() = 'service_role'
    or auth.uid() = user_id
  );

create policy p_memory_access_self on agents.memory
  for select using (
    exists (
      select 1
      from agents.sessions s
      where s.id = agents.memory.session_id
        and (
          s.user_id is null
          or auth.role() = 'service_role'
          or auth.uid() = s.user_id
        )
    )
  );

create policy p_memory_insert_self on agents.memory
  for insert with check (
    exists (
      select 1
      from agents.sessions s
      where s.id = agents.memory.session_id
        and (
          s.user_id is null
          or auth.role() = 'service_role'
          or auth.uid() = s.user_id
        )
    )
  );

create policy p_memory_update_self on agents.memory
  for update using (
    exists (
      select 1
      from agents.sessions s
      where s.id = agents.memory.session_id
        and (
          s.user_id is null
          or auth.role() = 'service_role'
          or auth.uid() = s.user_id
        )
    )
  )
  with check (
    exists (
      select 1
      from agents.sessions s
      where s.id = agents.memory.session_id
        and (
          s.user_id is null
          or auth.role() = 'service_role'
          or auth.uid() = s.user_id
        )
    )
  );

create policy p_events_access_self on agents.events
  for select using (
    exists (
      select 1
      from agents.sessions s
      where s.id = agents.events.session_id
        and (
          s.user_id is null
          or auth.role() = 'service_role'
          or auth.uid() = s.user_id
        )
    )
  );

create policy p_events_insert_ops on agents.events
  for insert with check (
    exists (
      select 1
      from agents.sessions s
      where s.id = agents.events.session_id
        and (
          s.user_id is null
          or auth.role() = 'service_role'
          or auth.uid() = s.user_id
        )
    )
  );
