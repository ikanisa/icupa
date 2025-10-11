set search_path = public, extensions;

-- Queue capturing agent proposed actions for staff approval
create table if not exists public.agent_action_queue (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  agent_type text not null,
  action_type text not null,
  payload jsonb not null,
  rationale text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','applied')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  applied_at timestamptz,
  notes jsonb not null default '{}'::jsonb
);

create index if not exists agent_action_queue_status_idx on public.agent_action_queue(status, created_at desc);
create index if not exists agent_action_queue_tenant_idx on public.agent_action_queue(tenant_id, status);

alter table public.agent_action_queue enable row level security;

drop policy if exists "Staff manage agent action queue" on public.agent_action_queue;
create policy "Staff manage agent action queue" on public.agent_action_queue
  for all using (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  )
  with check (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

drop policy if exists "Service role manages agent action queue" on public.agent_action_queue;
create policy "Service role manages agent action queue" on public.agent_action_queue
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Payment refund ledger capturing requests and approvals
create table if not exists public.payment_refunds (
  id uuid primary key default uuid_generate_v4(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','processed')),
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  processed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  processed_at timestamptz
);

create index if not exists payment_refunds_status_idx on public.payment_refunds(status, created_at desc);

alter table public.payment_refunds enable row level security;

drop policy if exists "Staff view refunds" on public.payment_refunds;
create policy "Staff view refunds" on public.payment_refunds
  for select using (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','cashier','admin','support']::role_t[])
  );

drop policy if exists "Staff manage refunds" on public.payment_refunds;
create policy "Staff manage refunds" on public.payment_refunds
  for update using (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','cashier','admin']::role_t[])
  )
  with check (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','cashier','admin']::role_t[])
  );

drop policy if exists "Service role manages refunds" on public.payment_refunds;
create policy "Service role manages refunds" on public.payment_refunds
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Daily reconciliation runs
create table if not exists public.payment_reconciliation_runs (
  id uuid primary key default uuid_generate_v4(),
  coverage_start date not null,
  coverage_end date not null,
  total_captured_cents bigint not null default 0,
  total_failed integer not null default 0,
  pending_payments integer not null default 0,
  discrepancies jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index if not exists payment_reconciliation_runs_window_idx on public.payment_reconciliation_runs(coverage_start, coverage_end);

alter table public.payment_reconciliation_runs enable row level security;

drop policy if exists "Staff read reconciliation" on public.payment_reconciliation_runs;
create policy "Staff read reconciliation" on public.payment_reconciliation_runs
  for select using (true);

drop policy if exists "Service role manages reconciliation" on public.payment_reconciliation_runs;
create policy "Service role manages reconciliation" on public.payment_reconciliation_runs
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.run_payment_reconciliation(p_window_start date, p_window_end date)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  captured_total bigint;
  failed_count integer;
  pending_count integer;
begin
  select coalesce(sum(amount_cents), 0)
    into captured_total
    from public.payments
    where status = 'captured'
      and created_at >= p_window_start
      and created_at < p_window_end + interval '1 day';

  select count(*)
    into failed_count
    from public.payments
    where status = 'failed'
      and created_at >= p_window_start
      and created_at < p_window_end + interval '1 day';

  select count(*)
    into pending_count
    from public.payments
    where status = 'pending'
      and created_at < p_window_end + interval '1 day';

  insert into public.payment_reconciliation_runs (
    coverage_start,
    coverage_end,
    total_captured_cents,
    total_failed,
    pending_payments,
    status,
    notes,
    completed_at
  )
  values (
    p_window_start,
    p_window_end,
    captured_total,
    failed_count,
    pending_count,
    'completed',
    null,
    timezone('utc', now())
  );
end;
$$;

grant execute on function public.run_payment_reconciliation(date, date) to service_role;

-- Schedule daily reconciliation at 02:00 UTC
do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'payment_reconciliation_daily'
  ) then
    perform cron.schedule(
      'payment_reconciliation_daily',
      '0 2 * * *',
      'call public.run_payment_reconciliation(current_date - interval ''1 day'', current_date - interval ''1 day'');'
    );
  end if;
end;
$$;
