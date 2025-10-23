set search_path = public, extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'payment_reconciliation_daily') then
    perform cron.unschedule('payment_reconciliation_daily');
  end if;
end;
$$;

drop function if exists public.run_payment_reconciliation(date, date);

drop policy if exists "Service role manages agent action queue" on public.agent_action_queue;
drop policy if exists "Staff manage agent action queue" on public.agent_action_queue;
drop table if exists public.agent_action_queue cascade;

drop policy if exists "Service role manages refunds" on public.payment_refunds;
drop policy if exists "Staff manage refunds" on public.payment_refunds;
drop policy if exists "Staff view refunds" on public.payment_refunds;
drop table if exists public.payment_refunds cascade;

drop policy if exists "Service role manages reconciliation" on public.payment_reconciliation_runs;
drop policy if exists "Staff read reconciliation" on public.payment_reconciliation_runs;
drop table if exists public.payment_reconciliation_runs cascade;
