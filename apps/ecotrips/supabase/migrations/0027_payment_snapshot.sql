create or replace function public.get_payment_snapshot(
  p_payment uuid
) returns table(
  id uuid,
  intent_id text,
  provider_ref text,
  status text,
  amount_cents bigint,
  currency text,
  created_at timestamptz
)
language sql
security definer
set search_path = payment, public
as $$
  select id,
         intent_id,
         provider_ref,
         status,
         amount_cents,
         currency,
         created_at
    from payment.payments
   where id = p_payment;
$$;

grant execute on function public.get_payment_snapshot(uuid) to authenticated;
