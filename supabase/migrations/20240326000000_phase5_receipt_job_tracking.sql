set search_path = public;

create table if not exists public.fiscalization_jobs (
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','failed','completed','skipped')),
  attempts integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  receipt_id uuid references public.receipts(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscalization_jobs_pkey primary key (order_id, payment_id)
);

create index if not exists fiscalization_jobs_status_idx on public.fiscalization_jobs(status);
create index if not exists fiscalization_jobs_updated_idx on public.fiscalization_jobs(updated_at desc);

alter table public.fiscalization_jobs enable row level security;

delete from public.fiscalization_jobs where order_id is null or payment_id is null;

create or replace function public.log_fiscalization_job_enqueue(order_uuid uuid, payment_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.fiscalization_jobs as f (
    order_id,
    payment_id,
    status,
    attempts,
    last_error,
    last_attempt_at,
    receipt_id,
    processed_at,
    updated_at
  )
  values (
    order_uuid,
    payment_uuid,
    'queued',
    0,
    null,
    null,
    null,
    null,
    now()
  )
  on conflict (order_id, payment_id) do update
  set status = 'queued',
      attempts = case when f.status = 'completed' then 0 else f.attempts end,
      last_error = null,
      last_attempt_at = null,
      receipt_id = null,
      processed_at = null,
      updated_at = now();
$$;

create or replace function public.log_fiscalization_job_processing(order_uuid uuid, payment_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.fiscalization_jobs as f (
    order_id,
    payment_id,
    status,
    attempts,
    last_error,
    last_attempt_at,
    updated_at
  )
  values (
    order_uuid,
    payment_uuid,
    'processing',
    1,
    null,
    now(),
    now()
  )
  on conflict (order_id, payment_id) do update
  set status = 'processing',
      attempts = f.attempts + 1,
      last_error = null,
      last_attempt_at = now(),
      updated_at = now();
$$;

create or replace function public.log_fiscalization_job_completed(order_uuid uuid, payment_uuid uuid, receipt_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.fiscalization_jobs as f (
    order_id,
    payment_id,
    status,
    attempts,
    receipt_id,
    processed_at,
    last_error,
    updated_at
  )
  values (
    order_uuid,
    payment_uuid,
    'completed',
    1,
    receipt_uuid,
    now(),
    null,
    now()
  )
  on conflict (order_id, payment_id) do update
  set status = 'completed',
      attempts = greatest(f.attempts, 1),
      receipt_id = receipt_uuid,
      processed_at = now(),
      last_error = null,
      updated_at = now();
$$;

create or replace function public.log_fiscalization_job_failed(order_uuid uuid, payment_uuid uuid, failure_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.fiscalization_jobs as f (
    order_id,
    payment_id,
    status,
    attempts,
    last_error,
    last_attempt_at,
    updated_at
  )
  values (
    order_uuid,
    payment_uuid,
    'failed',
    1,
    left(coalesce(failure_reason, 'Receipt generation failed'), 400),
    now(),
    now()
  )
  on conflict (order_id, payment_id) do update
  set status = 'failed',
      attempts = greatest(f.attempts, 1),
      last_error = left(coalesce(failure_reason, 'Receipt generation failed'), 400),
      last_attempt_at = now(),
      updated_at = now();
$$;

create or replace function public.log_fiscalization_job_skipped(order_uuid uuid, payment_uuid uuid, skip_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.fiscalization_jobs as f (
    order_id,
    payment_id,
    status,
    attempts,
    last_error,
    processed_at,
    updated_at
  )
  values (
    order_uuid,
    payment_uuid,
    'skipped',
    1,
    left(coalesce(skip_reason, 'Fiscalisation job skipped'), 400),
    now(),
    now()
  )
  on conflict (order_id, payment_id) do update
  set status = 'skipped',
      attempts = greatest(f.attempts, 1),
      last_error = left(coalesce(skip_reason, 'Fiscalisation job skipped'), 400),
      processed_at = now(),
      updated_at = now();
$$;

grant execute on function public.log_fiscalization_job_enqueue(uuid, uuid) to service_role;
grant execute on function public.log_fiscalization_job_processing(uuid, uuid) to service_role;
grant execute on function public.log_fiscalization_job_completed(uuid, uuid, uuid) to service_role;
grant execute on function public.log_fiscalization_job_failed(uuid, uuid, text) to service_role;
grant execute on function public.log_fiscalization_job_skipped(uuid, uuid, text) to service_role;

grant select on public.fiscalization_jobs to authenticated;

create policy if not exists "Staff read fiscalization jobs" on public.fiscalization_jobs
  for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = fiscalization_jobs.order_id
        and is_staff_of(
          o.tenant_id,
          array['owner','manager','cashier','server','chef','kds','admin']::role_t[]
        )
    )
  );

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

  perform public.log_fiscalization_job_enqueue(order_uuid, payment_uuid);

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
