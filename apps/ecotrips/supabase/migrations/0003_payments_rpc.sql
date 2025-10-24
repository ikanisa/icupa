create or replace function payment.ensure_payment_record(
  p_itinerary uuid,
  p_amount_cents bigint,
  p_currency text,
  p_idempotency text
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into payment.payments (
    id,
    itinerary_id,
    amount_cents,
    currency,
    provider,
    status,
    idempotency_key
  )
  values (
    v_id,
    p_itinerary,
    p_amount_cents,
    p_currency,
    'stripe',
    'processing',
    p_idempotency
  );

  return v_id;
end;
$$;

grant execute on function payment.ensure_payment_record(
  uuid,
  bigint,
  text,
  text
) to authenticated;
