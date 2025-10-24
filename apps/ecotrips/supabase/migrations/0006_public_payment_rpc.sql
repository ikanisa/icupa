create or replace function public.ensure_payment_record(
  p_itinerary uuid,
  p_amount_cents bigint,
  p_currency text,
  p_idempotency text
)
returns uuid
language sql
security definer
set search_path = payment, public
as $$
  select payment.ensure_payment_record(p_itinerary, p_amount_cents, p_currency, p_idempotency);
$$;

grant execute on function public.ensure_payment_record(
  uuid,
  bigint,
  text,
  text
) to authenticated;
