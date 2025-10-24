create or replace view public.group_payouts_view as
select id, escrow_id, total_cents, currency, status, attempts, last_error, created_at, updated_at
from "group".payouts;

grant select on public.group_payouts_view to authenticated;

grant select on public.group_payouts_view to anon;

create or replace function public.insert_group_payout(
  p_escrow uuid,
  p_total bigint,
  p_currency text,
  p_status text,
  p_last_error text default null
) returns "group".payouts
language plpgsql
security definer
set search_path = "group", public
as $$
declare
  inserted "group".payouts;
begin
  insert into "group".payouts (escrow_id, total_cents, currency, status, last_error)
  values (p_escrow, p_total, coalesce(p_currency, 'USD'), coalesce(p_status, 'pending'), p_last_error)
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.insert_group_payout(uuid, bigint, text, text, text)
  to authenticated;

grant execute on function public.insert_group_payout(uuid, bigint, text, text, text)
  to anon;

create or replace function public.update_group_payout_status(
  p_payout uuid,
  p_status text
) returns "group".payouts
language plpgsql
security definer
set search_path = "group", public
as $$
declare
  updated "group".payouts;
begin
  update "group".payouts
     set status = p_status,
         updated_at = now()
   where id = p_payout
  returning * into updated;
  return updated;
end;
$$;

grant execute on function public.update_group_payout_status(uuid, text)
  to authenticated;

grant execute on function public.update_group_payout_status(uuid, text)
  to anon;

create or replace function public.mark_group_escrow_paid(
  p_escrow uuid
) returns "group".escrows
language plpgsql
security definer
set search_path = "group", public
as $$
declare
  updated "group".escrows;
begin
  update "group".escrows
     set status = 'paid_out',
         paid_out_at = now()
   where id = p_escrow
  returning * into updated;
  return updated;
end;
$$;

grant execute on function public.mark_group_escrow_paid(uuid)
  to authenticated;

grant execute on function public.mark_group_escrow_paid(uuid)
  to anon;
