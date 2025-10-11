-- Adds diner-facing visibility into payment status updates and stores provider failure reasons
-- while ensuring provider reference lookups remain efficient for webhook reconciliation.

set search_path = public;

alter table public.payments
  add column if not exists failure_reason text;

create index if not exists idx_payments_provider_ref
  on public.payments(provider_ref);

drop policy if exists "Diner view own payments" on public.payments;
create policy "Diner view own payments" on public.payments
  for select using (
    exists (
      select 1
      from public.orders o
      where o.id = payments.order_id
        and (
          o.table_session_id = public.current_table_session_id()
          or o.customer_id = auth.uid()
        )
    )
  );
