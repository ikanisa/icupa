-- Enforce that table sessions referenced by RLS helpers are still active
set search_path = public;

create or replace function public.current_table_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  raw_headers text;
  session_id uuid;
  expires_at timestamptz;
begin
  raw_headers := current_setting('request.headers', true);
  if raw_headers is null or raw_headers = '' then
    return null;
  end if;

  begin
    session_id := nullif((raw_headers::jsonb)->>'x-icupa-session', '')::uuid;
  exception when others then
    return null;
  end;

  if session_id is null then
    return null;
  end if;

  select ts.expires_at
    into expires_at
  from public.table_sessions ts
  where ts.id = session_id
  limit 1;

  if expires_at is null then
    return null;
  end if;

  if expires_at <= now() then
    return null;
  end if;

  return session_id;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.current_table_session_id() from public;
grant execute on function public.current_table_session_id() to anon, authenticated, service_role;
