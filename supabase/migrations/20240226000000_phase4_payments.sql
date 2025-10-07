-- Phase 4 payments queue and helpers
set search_path = public;

do $$
begin
  if not exists (
    select 1
    from pgmq.list_queues()
    where queue_name = 'fiscalization_jobs'
  ) then
    perform pgmq.create_queue('fiscalization_jobs');
  end if;
end;
$$;

create or replace function public.enqueue_fiscalization_job(order_uuid uuid, payment_uuid uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  result bigint;
begin
  if order_uuid is null or payment_uuid is null then
    raise exception 'order_uuid and payment_uuid must be provided';
  end if;
  select pgmq.send(
    queue_name => 'fiscalization_jobs',
    message => jsonb_build_object(
      'order_id', order_uuid,
      'payment_id', payment_uuid,
      'enqueued_at', now()
    )
  )
  into result;
  return result;
end;
$$;

grant execute on function public.enqueue_fiscalization_job(uuid, uuid) to service_role;
