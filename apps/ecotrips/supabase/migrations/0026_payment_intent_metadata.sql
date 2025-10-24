create or replace function public.update_payment_intent_metadata(
  p_payment uuid,
  p_intent text,
  p_status text
) returns void
language sql
security definer
set search_path = payment, public
as $$
  update payment.payments
     set intent_id = coalesce(p_intent, intent_id),
         provider_ref = coalesce(p_intent, provider_ref),
         status = coalesce(p_status, status)
   where id = p_payment;
$$;

grant execute on function public.update_payment_intent_metadata(uuid, text, text)
  to authenticated;
