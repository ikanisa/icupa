-- Phase 5 fiscalisation helpers
set search_path = public;

create or replace function public.dequeue_fiscalization_job(visibility_timeout_seconds integer default 60)
returns table (
  msg_id bigint,
  order_id uuid,
  payment_id uuid,
  enqueued_at timestamptz
)
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  job record;
begin
  select *
  into job
  from pgmq.dequeue('fiscalization_jobs', visibility_timeout_seconds, 1)
  limit 1;

  if not found or job is null then
    return;
  end if;

  return query
  select
    job.msg_id,
    (job.message->>'order_id')::uuid as order_id,
    (job.message->>'payment_id')::uuid as payment_id,
    coalesce((job.message->>'enqueued_at')::timestamptz, now()) as enqueued_at;
end;
$$;

grant execute on function public.dequeue_fiscalization_job(integer) to service_role;

create or replace function public.delete_fiscalization_job(msg_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  perform pgmq.delete('fiscalization_jobs', msg_id);
end;
$$;

grant execute on function public.delete_fiscalization_job(bigint) to service_role;
