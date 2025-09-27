begin;

set local role service_role;

-- Seed minimal tenant/location/table context for the receipt queue check.
insert into public.tenants (id, name, region)
values (
  '00000000-0000-4000-9000-000000000501',
  'Receipt Queue Tenant',
  'RW'
)
on conflict (id) do nothing;

insert into public.locations (id, tenant_id, name, currency, timezone, vat_rate, region)
values (
  '00000000-0000-4000-9000-000000000601',
  '00000000-0000-4000-9000-000000000501',
  'Queue Test Location',
  'RWF',
  'Africa/Kigali',
  18,
  'RW'
)
on conflict (id) do nothing;

insert into public.tables (id, location_id, code, seats, qrtoken)
values (
  '00000000-0000-4000-9000-000000000701',
  '00000000-0000-4000-9000-000000000601',
  'TQ-1',
  2,
  'queue-test-token'
)
on conflict (id) do nothing;

insert into public.table_sessions (id, table_id, expires_at)
values (
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-9000-000000000701',
  now() + interval '2 hours'
)
on conflict (id) do nothing;

insert into public.orders (
  id,
  tenant_id,
  location_id,
  table_id,
  table_session_id,
  status,
  subtotal_cents,
  tax_cents,
  service_cents,
  total_cents,
  currency
)
values (
  '00000000-0000-4000-9000-000000000801',
  '00000000-0000-4000-9000-000000000501',
  '00000000-0000-4000-9000-000000000601',
  '00000000-0000-4000-9000-000000000701',
  '00000000-0000-4000-8000-000000000701',
  'settled',
  1000,
  180,
  0,
  1180,
  'RWF'
)
on conflict (id) do nothing;

insert into public.payments (
  id,
  order_id,
  method,
  status,
  amount_cents,
  currency,
  provider_ref
)
values (
  '00000000-0000-4000-9000-000000000901',
  '00000000-0000-4000-9000-000000000801',
  'stripe',
  'captured',
  1180,
  'RWF',
  'test-queue-provider'
)
on conflict (id) do nothing;

-- Enqueue a fiscalisation job and assert a message is created.
do $$
declare
  queue_msg_id bigint;
  dequeued_msg_id bigint;
  dequeued_order uuid;
  dequeued_payment uuid;
  remaining_count integer;
  job_status text;
  job_attempts integer;
  job_last_error text;
  job_last_attempt timestamptz;
  job_receipt uuid;
  job_processed timestamptz;
begin
  select public.enqueue_fiscalization_job(
    '00000000-0000-4000-9000-000000000801',
    '00000000-0000-4000-9000-000000000901'
  )
  into queue_msg_id;

  if queue_msg_id is null then
    raise exception 'Fiscalisation job should return a msg_id';
  end if;

  select status, attempts, receipt_id
  into job_status, job_attempts, job_receipt
  from public.fiscalization_jobs
  where order_id = '00000000-0000-4000-9000-000000000801'
    and payment_id = '00000000-0000-4000-9000-000000000901';

  if job_status is distinct from 'queued' then
    raise exception 'Fiscalisation job should be queued after enqueue';
  end if;

  if job_attempts <> 0 then
    raise exception 'Attempts should start at zero after enqueue';
  end if;

  if job_receipt is not null then
    raise exception 'Receipt should not be linked yet';
  end if;

  perform public.log_fiscalization_job_processing(
    '00000000-0000-4000-9000-000000000801',
    '00000000-0000-4000-9000-000000000901'
  );

  select status, attempts, last_attempt_at
  into job_status, job_attempts, job_last_attempt
  from public.fiscalization_jobs
  where order_id = '00000000-0000-4000-9000-000000000801'
    and payment_id = '00000000-0000-4000-9000-000000000901';

  if job_status is distinct from 'processing' then
    raise exception 'Status should be processing after log_fiscalization_job_processing';
  end if;

  if job_attempts <> 1 then
    raise exception 'Attempts should increment when processing is logged';
  end if;

  if job_last_attempt is null then
    raise exception 'Last attempt timestamp should be recorded';
  end if;

  perform public.log_fiscalization_job_failed(
    '00000000-0000-4000-9000-000000000801',
    '00000000-0000-4000-9000-000000000901',
    'Temporary failure'
  );

  select status, last_error
  into job_status, job_last_error
  from public.fiscalization_jobs
  where order_id = '00000000-0000-4000-9000-000000000801'
    and payment_id = '00000000-0000-4000-9000-000000000901';

  if job_status is distinct from 'failed' then
    raise exception 'Status should be failed after failure is logged';
  end if;

  if job_last_error is distinct from 'Temporary failure' then
    raise exception 'Failure reason should be recorded';
  end if;

  select msg_id, order_id, payment_id
  into dequeued_msg_id, dequeued_order, dequeued_payment
  from public.dequeue_fiscalization_job(300)
  limit 1;

  if dequeued_msg_id is null then
    raise exception 'Fiscalisation job should be dequeued';
  end if;

  if dequeued_msg_id <> queue_msg_id then
    raise exception 'Dequeued message id mismatch';
  end if;

  if dequeued_order is distinct from '00000000-0000-4000-9000-000000000801' then
    raise exception 'Dequeued order id mismatch';
  end if;

  if dequeued_payment is distinct from '00000000-0000-4000-9000-000000000901' then
    raise exception 'Dequeued payment id mismatch';
  end if;

  perform public.delete_fiscalization_job(dequeued_msg_id);

  insert into public.receipts (id, order_id, region, payload)
  values (
    '00000000-0000-4000-9000-000000000a01',
    '00000000-0000-4000-9000-000000000801',
    'RW',
    jsonb_build_object('summary', jsonb_build_object('fiscalId', 'EBM-TEST'))
  )
  on conflict (id) do nothing;

  perform public.log_fiscalization_job_completed(
    '00000000-0000-4000-9000-000000000801',
    '00000000-0000-4000-9000-000000000901',
    '00000000-0000-4000-9000-000000000a01'
  );

  select status, receipt_id, processed_at
  into job_status, job_receipt, job_processed
  from public.fiscalization_jobs
  where order_id = '00000000-0000-4000-9000-000000000801'
    and payment_id = '00000000-0000-4000-9000-000000000901';

  if job_status is distinct from 'completed' then
    raise exception 'Status should be completed after success is logged';
  end if;

  if job_receipt is distinct from '00000000-0000-4000-9000-000000000a01' then
    raise exception 'Completed job should reference the receipt id';
  end if;

  if job_processed is null then
    raise exception 'Processed timestamp should be captured';
  end if;

  perform public.log_fiscalization_job_enqueue(
    '00000000-0000-4000-9000-000000000801',
    '00000000-0000-4000-9000-000000000901'
  );

  select status, attempts
  into job_status, job_attempts
  from public.fiscalization_jobs
  where order_id = '00000000-0000-4000-9000-000000000801'
    and payment_id = '00000000-0000-4000-9000-000000000901';

  if job_status is distinct from 'queued' then
    raise exception 'Enqueue should reset status to queued';
  end if;

  if job_attempts <> 0 then
    raise exception 'Attempts should reset after re-queueing a completed job';
  end if;

  with remaining as (
    select * from public.dequeue_fiscalization_job(300)
  )
  select count(*)
  into remaining_count
  from remaining;

  if remaining_count <> 0 then
    raise exception 'Fiscalisation queue should be empty after delete';
  end if;
end;
$$;

rollback;
