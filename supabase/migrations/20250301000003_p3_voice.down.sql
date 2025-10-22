set search_path = public, extensions;

drop policy if exists "table session reads own voice token" on public.voice_sessions;
drop policy if exists "service role manages voice sessions" on public.voice_sessions;
drop table if exists public.voice_sessions cascade;
