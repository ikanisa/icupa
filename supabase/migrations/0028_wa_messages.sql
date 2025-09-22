create table if not exists agents.messages (
  id bigserial primary key,
  session_id uuid,
  user_wa text,
  user_id uuid,
  direction text not null check (direction in ('in','out')),
  channel text not null default 'whatsapp',
  body jsonb not null default '{}'::jsonb,
  wa_message_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_agents_messages_wa_id
  on agents.messages (wa_message_id);

alter table agents.messages enable row level security;

create policy p_agents_messages_service on agents.messages
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.agent_store_message(
  p_user_wa text,
  p_user uuid,
  p_session uuid,
  p_direction text,
  p_channel text,
  p_body jsonb,
  p_wa_message_id text
) returns agents.messages
language plpgsql
security definer
set search_path = agents, public
as $$
declare
  inserted agents.messages;
begin
  insert into agents.messages (
    user_wa,
    user_id,
    session_id,
    direction,
    channel,
    body,
    wa_message_id
  )
  values (
    p_user_wa,
    p_user,
    p_session,
    p_direction,
    coalesce(p_channel, 'whatsapp'),
    coalesce(p_body, '{}'::jsonb),
    p_wa_message_id
  )
  on conflict (wa_message_id) do update
    set session_id = coalesce(excluded.session_id, agents.messages.session_id),
        body = excluded.body,
        direction = excluded.direction,
        channel = excluded.channel
  returning * into inserted;

  return inserted;
end;
$$;

grant execute on function public.agent_store_message(
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated;

create or replace function public.agent_message_exists(
  p_wa_message_id text
) returns boolean
language sql
security definer
set search_path = agents, public
as $$
  select exists(
    select 1 from agents.messages m where m.wa_message_id = p_wa_message_id
  );
$$;

grant execute on function public.agent_message_exists(text) to authenticated;

create or replace function public.agent_latest_session(
  p_user_wa text
) returns uuid
language sql
security definer
set search_path = agents, public
as $$
  select session_id
    from agents.messages
   where user_wa = p_user_wa
     and session_id is not null
   order by created_at desc
   limit 1;
$$;

grant execute on function public.agent_latest_session(text) to authenticated;

create or replace function public.agent_recent_messages(
  p_limit int default 10
) returns table(id bigint, direction text, body jsonb, created_at timestamptz)
language sql
security definer
set search_path = agents, public
as $$
  select id, direction, body, created_at
    from agents.messages
   order by created_at desc
   limit coalesce(p_limit, 10);
$$;

grant execute on function public.agent_recent_messages(int) to authenticated;
