set search_path = public;

-- Aggregated view of fiscalisation queue health for merchant staff dashboards.
create or replace function public.fiscalization_queue_summary()
returns table (
  status text,
  job_count bigint,
  oldest_created_at timestamptz,
  longest_wait_seconds integer,
  latest_attempt_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  next_order_id uuid,
  next_payment_id uuid
)
language sql
security definer
set search_path = public
as $$
  with scoped_jobs as (
    select
      fj.order_id,
      fj.payment_id,
      fj.status,
      fj.created_at,
      fj.updated_at,
      fj.last_attempt_at,
      fj.last_error,
      o.tenant_id
    from public.fiscalization_jobs fj
    join public.orders o
      on o.id = fj.order_id
    where is_staff_of(
      o.tenant_id,
      array['owner','manager','cashier','server','chef','kds','admin']::role_t[]
    )
  )
  select
    status,
    count(*)::bigint as job_count,
    min(created_at) as oldest_created_at,
    coalesce(floor(extract(epoch from (now() - min(created_at)))), 0)::integer as longest_wait_seconds,
    max(last_attempt_at) as latest_attempt_at,
    max(last_error) filter (where last_error is not null) as last_error,
    max(last_attempt_at) filter (where last_error is not null) as last_error_at,
    (array_agg(order_id order by created_at asc, order_id asc))[1] as next_order_id,
    (array_agg(payment_id order by created_at asc, payment_id asc))[1] as next_payment_id
  from scoped_jobs
  group by status
  order by status;
$$;

grant execute on function public.fiscalization_queue_summary() to authenticated;
