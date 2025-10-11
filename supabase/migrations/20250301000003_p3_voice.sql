set search_path = public, extensions;

create table if not exists public.voice_sessions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  table_session_id uuid references public.table_sessions(id) on delete cascade,
  client_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists voice_sessions_table_idx on public.voice_sessions(table_session_id, expires_at);

alter table public.voice_sessions enable row level security;

drop policy if exists "service role manages voice sessions" on public.voice_sessions;
create policy "service role manages voice sessions"
  on public.voice_sessions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "table session reads own voice token" on public.voice_sessions;
create policy "table session reads own voice token"
  on public.voice_sessions
  for select using (
    table_session_id = nullif(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-icupa-session', '')::uuid
  );
