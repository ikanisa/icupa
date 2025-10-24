create schema if not exists agents;

create table if not exists agents.chat_state (
  id bigserial primary key,
  user_wa text not null,
  state text not null default 'idle',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_agents_chat_state_user_wa
  on agents.chat_state (user_wa);

alter table agents.chat_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'agents'
      and tablename = 'chat_state'
      and policyname = 'p_chat_state_service_role'
  ) then
    create policy p_chat_state_service_role on agents.chat_state
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

grant select, insert, update, delete on agents.chat_state to service_role;

create or replace function agents.upsert_chat_state(
  p_user_wa text,
  p_state text default null,
  p_data jsonb default null
) returns void
language plpgsql
security definer
set search_path = agents, public
as $$
begin
  insert into agents.chat_state (user_wa, state, data, updated_at)
  values (
    p_user_wa,
    coalesce(nullif(p_state, ''), 'idle'),
    coalesce(p_data, '{}'::jsonb),
    now()
  )
  on conflict (user_wa) do update
    set state = coalesce(nullif(p_state, ''), agents.chat_state.state),
        data = case
          when p_data is null then agents.chat_state.data
          else p_data
        end,
        updated_at = now();
  return;
end;
$$;

grant execute on function agents.upsert_chat_state(text, text, jsonb) to service_role;

create or replace function public.agents_upsert_chat_state(
  p_user_wa text,
  p_state text default null,
  p_data jsonb default null
) returns void
language plpgsql
security definer
set search_path = agents, public
as $$
begin
  perform agents.upsert_chat_state(p_user_wa, p_state, p_data);
  return;
end;
$$;

grant execute on function public.agents_upsert_chat_state(text, text, jsonb) to service_role;

create or replace function public.agents_get_chat_state(
  p_user_wa text
) returns table(state text, data jsonb)
language sql
security definer
set search_path = agents, public
as $$
  select state, data
    from agents.chat_state
   where user_wa = p_user_wa
   order by updated_at desc
   limit 1;
$$;

grant execute on function public.agents_get_chat_state(text) to service_role;
