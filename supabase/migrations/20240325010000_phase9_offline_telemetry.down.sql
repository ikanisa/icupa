set search_path = public, extensions;

drop trigger if exists offline_sync_events_enrich on public.offline_sync_events;
drop function if exists public.populate_offline_sync_event();
drop policy if exists "merchant staff read offline sync events" on public.offline_sync_events;
drop policy if exists "diners read their offline sync events" on public.offline_sync_events;
drop policy if exists "diners log offline sync events" on public.offline_sync_events;
drop policy if exists "service role manages offline sync events" on public.offline_sync_events;
drop table if exists public.offline_sync_events cascade;
