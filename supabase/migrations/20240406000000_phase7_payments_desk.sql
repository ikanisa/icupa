set search_path = public;

-- Phase 7 extension: merchant payments desk helpers

alter table public.payments
  add column if not exists captured_at timestamptz,
  add column if not exists captured_by uuid references auth.users(id),
  add column if not exists captured_notes text;

create table if not exists public.payment_action_events (
  id uuid primary key default uuid_generate_v4(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  action text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_action_events_payment on public.payment_action_events(payment_id, created_at desc);

alter table public.payment_action_events enable row level security;

create policy if not exists "Staff view payment action events" on public.payment_action_events
  for select using (
    exists (
      select 1
        from public.orders o
       where o.id = payment_action_events.order_id
         and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','admin']::role_t[])
    )
  );

create policy if not exists "Staff insert payment action events" on public.payment_action_events
  for insert with check (
    exists (
      select 1
        from public.orders o
       where o.id = payment_action_events.order_id
         and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','admin']::role_t[])
    )
  );

create or replace function public.merchant_outstanding_payments(p_location uuid default null)
returns table (
  payment_id uuid,
  order_id uuid,
  tenant_id uuid,
  location_id uuid,
  table_id uuid,
  table_code text,
  table_state table_state_t,
  order_status order_status_t,
  payment_status payment_status_t,
  method payment_method_t,
  amount_cents integer,
  total_cents integer,
  currency char(3),
  failure_reason text,
  provider_ref text,
  created_at timestamptz,
  captured_at timestamptz,
  captured_by uuid,
  captured_notes text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as payment_id,
    o.id as order_id,
    o.tenant_id,
    o.location_id,
    o.table_id,
    t.code as table_code,
    t.state as table_state,
    o.status as order_status,
    p.status as payment_status,
    p.method,
    p.amount_cents,
    o.total_cents,
    o.currency,
    p.failure_reason,
    p.provider_ref,
    p.created_at,
    p.captured_at,
    p.captured_by,
    p.captured_notes
  from public.payments p
  join public.orders o on o.id = p.order_id
  left join public.tables t on t.id = o.table_id
  where
    (
      p.status is distinct from 'captured' and p.status is distinct from 'refunded'
    
      or o.status is distinct from 'settled'
    )
    and (p_location is null or o.location_id = p_location)
    and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','admin']::role_t[])
  order by o.created_at desc, p.created_at desc
$$;

grant execute on function public.merchant_outstanding_payments(uuid) to authenticated;
