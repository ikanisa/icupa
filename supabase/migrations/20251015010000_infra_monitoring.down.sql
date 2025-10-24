set search_path = public, extensions;

drop function if exists public.list_cron_jobs();
drop function if exists public.list_queue_metrics();
revoke select on all tables in schema monitoring from authenticated, service_role;
revoke usage on schema monitoring from authenticated, service_role;
drop schema if exists monitoring cascade;
