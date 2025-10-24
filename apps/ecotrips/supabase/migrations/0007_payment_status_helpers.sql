create or replace function public.set_payment_status(
  p_payment uuid,
  p_status text,
  p_provider_ref text
)
returns void
language sql
security definer
set search_path = payment, public
as $$
  update payment.payments
  set status = p_status,
      provider_ref = coalesce(p_provider_ref, provider_ref)
  where id = p_payment;
$$;

grant execute on function public.set_payment_status(
  uuid,
  text,
  text
) to authenticated;

create or replace function public.record_payment_failure_event(
  p_payment uuid,
  p_intent text,
  p_type text
)
returns void
language sql
security definer
set search_path = audit, public
as $$
  insert into audit.events (what, payload)
  values (
    'payment.failure',
    jsonb_build_object(
      'payment_id', p_payment,
      'intent', p_intent,
      'type', p_type
    )
  );
$$;

grant execute on function public.record_payment_failure_event(
  uuid,
  text,
  text
) to authenticated;
