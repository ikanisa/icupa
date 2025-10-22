set search_path = public, extensions;

drop policy if exists "Staff view dsr requests" on public.dsr_requests;
drop policy if exists "Service role manages dsr requests" on public.dsr_requests;
drop table if exists public.dsr_requests cascade;
