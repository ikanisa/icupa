set search_path = public, extensions;

-- Ensure monitoring schema exists for infra dashboards
create schema if not exists monitoring;

-- PGMQ metrics view surfacing queue depth and poison counts
create or replace view monitoring.pgmq_queue_metrics as
select
  queue_name,
  queue_length,
  newest_msg_age_sec,
  oldest_msg_age_sec,
  total_messages,
  scrape_time
from pgmq.metrics_all();

comment on view monitoring.pgmq_queue_metrics is
  'live PGMQ queue metrics for observability dashboards';

-- CRON job status view for admin visibility
create or replace view monitoring.cron_job_metrics as
with run_stats as (
  select
    jobid,
    max(start_time) as last_run,
    max(start_time) filter (where status = 'succeeded') as last_success,
    max(start_time) filter (where status <> 'succeeded') as last_error
  from cron.job_run_details
  group by jobid
)
select
  j.jobid,
  j.jobname,
  j.schedule,
  j.command,
  j.active,
  rs.last_run,
  rs.last_success,
  rs.last_error
from cron.job j
left join run_stats rs using (jobid);

comment on view monitoring.cron_job_metrics is
  'current pg_cron job schedules and last run status';

-- Grant read access to service role and authenticated users for dashboards
grant usage on schema monitoring to authenticated, service_role;
grant select on all tables in schema monitoring to authenticated, service_role;

alter default privileges in schema monitoring grant select on tables to authenticated, service_role;
alter default privileges in schema monitoring grant select on sequences to authenticated, service_role;

-- Helper function to expose queue metrics via RPC if needed
create or replace function public.list_queue_metrics()
returns table (
  queue_name text,
  queue_length bigint,
  newest_msg_age_sec numeric,
  oldest_msg_age_sec numeric,
  total_messages bigint,
  scrape_time timestamptz
)
language sql
security definer
set search_path = public, monitoring
stable
as $$
  select *
  from monitoring.pgmq_queue_metrics
  where coalesce(auth.role(), 'service_role') = 'service_role'
     or exists (
       select 1
       from public.user_roles ur
       where ur.user_id = auth.uid()
         and ur.role in ('owner','admin','support')
     );
$$;

grant execute on function public.list_queue_metrics() to authenticated, service_role;

comment on function public.list_queue_metrics() is
  'Returns queue depth metrics for UI dashboards and alerts.';

-- Helper function for cron job monitoring
create or replace function public.list_cron_jobs()
returns table (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  active boolean,
  last_run timestamptz,
  last_success timestamptz,
  last_error timestamptz
)
language sql
security definer
set search_path = public, monitoring
stable
as $$
  select *
  from monitoring.cron_job_metrics
  where coalesce(auth.role(), 'service_role') = 'service_role'
     or exists (
       select 1
       from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role in ('owner','admin','support')
     );
$$;

grant execute on function public.list_cron_jobs() to authenticated, service_role;

comment on function public.list_cron_jobs() is
  'Returns pg_cron job status for admin dashboards.';
