set search_path = public;

create or replace function public.fin_insert_ledger(
  p_payment_id uuid,
  p_itinerary_id uuid,
  p_entry_type text,
  p_amount_cents bigint,
  p_currency text,
  p_provider_ref text,
  p_note text
)
returns setof fin.ledger
language sql
security definer
set search_path = fin, public
as $$
  insert into fin.ledger (payment_id, itinerary_id, entry_type, amount_cents, currency, provider_ref, note)
  values (p_payment_id, p_itinerary_id, p_entry_type, p_amount_cents, coalesce(p_currency, 'USD'), p_provider_ref, p_note)
  on conflict (entry_type, coalesce(payment_id::text, '00000000-0000-0000-0000-000000000000'), coalesce(provider_ref, ''))
  do update set
    itinerary_id = excluded.itinerary_id,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    note = excluded.note
  returning *;
$$;

grant execute on function public.fin_insert_ledger(uuid, uuid, text, bigint, text, text, text) to service_role;

create or replace function public.fin_find_ledger(
  p_entry_type text,
  p_payment_id uuid,
  p_provider_ref text
)
returns setof fin.ledger
language sql
security definer
set search_path = fin, public
as $$
  select *
    from fin.ledger
   where entry_type = p_entry_type
     and coalesce(payment_id, '00000000-0000-0000-0000-000000000000') = coalesce(p_payment_id, '00000000-0000-0000-0000-000000000000')
     and coalesce(provider_ref, '') = coalesce(p_provider_ref, '')
   limit 1;
$$;

grant execute on function public.fin_find_ledger(text, uuid, text) to service_role;

create or replace function public.fin_latest_refund(
  p_payment_id uuid
)
returns setof fin.ledger
language sql
security definer
set search_path = fin, public
as $$
  select *
    from fin.ledger
   where payment_id = p_payment_id
     and entry_type = 'refund_succeeded'
   order by occurred_at desc
   limit 1;
$$;

grant execute on function public.fin_latest_refund(uuid) to service_role;

create or replace function public.fin_select_invoice(
  p_payment_id uuid,
  p_kind text
)
returns setof fin.invoices
language sql
security definer
set search_path = fin, public
as $$
  select *
    from fin.invoices
   where payment_id = p_payment_id
     and kind = p_kind
   order by created_at desc
   limit 1;
$$;

grant execute on function public.fin_select_invoice(uuid, text) to service_role;

create or replace function public.fin_insert_invoice(
  p_payment_id uuid,
  p_itinerary_id uuid,
  p_kind text,
  p_number text,
  p_total_cents bigint,
  p_currency text,
  p_storage_path text
)
returns setof fin.invoices
language sql
security definer
set search_path = fin, public
as $$
  insert into fin.invoices (payment_id, itinerary_id, kind, number, total_cents, currency, storage_path)
  values (p_payment_id, p_itinerary_id, p_kind, p_number, p_total_cents, coalesce(p_currency, 'USD'), p_storage_path)
  on conflict (number)
  do update set
    storage_path = excluded.storage_path,
    total_cents = excluded.total_cents,
    currency = excluded.currency,
    itinerary_id = excluded.itinerary_id
  returning *;
$$;

grant execute on function public.fin_insert_invoice(uuid, uuid, text, text, bigint, text, text) to service_role;

create or replace function public.fin_update_invoice_storage(
  p_invoice_id uuid,
  p_storage_path text
)
returns void
language sql
security definer
set search_path = fin, public
as $$
  update fin.invoices
     set storage_path = p_storage_path
   where id = p_invoice_id;
$$;

grant execute on function public.fin_update_invoice_storage(uuid, text) to service_role;
