set search_path = public;

drop policy if exists "Diner view own payments" on public.payments;
drop index if exists public.idx_payments_provider_ref;
alter table public.payments drop column if exists failure_reason;
