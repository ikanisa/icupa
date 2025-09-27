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
begin
  select public.enqueue_fiscalization_job(
    '00000000-0000-4000-9000-000000000801',
    '00000000-0000-4000-9000-000000000901'
  )
  into queue_msg_id;

  if queue_msg_id is null then
    raise exception 'Fiscalisation job should return a msg_id';
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
