set search_path = public, extensions;

-- Enable RLS for inventory tables and define tenant-aware policies
alter table if exists public.inventory_items enable row level security;
alter table if exists public.item_ingredients enable row level security;

drop policy if exists "Inventory visible to staff" on public.inventory_items;
create policy "Inventory visible to staff" on public.inventory_items
  for select using (
    is_staff_for_tenant(tenant_id, array['owner','manager','cashier','chef','admin','support']::role_t[])
  );

drop policy if exists "Inventory managed by staff" on public.inventory_items;
create policy "Inventory managed by staff" on public.inventory_items
  for all using (
    is_staff_for_tenant(tenant_id, array['owner','manager','cashier','chef','admin','support']::role_t[])
  )
  with check (
    is_staff_for_tenant(tenant_id, array['owner','manager','cashier','chef','admin','support']::role_t[])
  );

drop policy if exists "Item ingredients follow inventory" on public.item_ingredients;
create policy "Item ingredients follow inventory" on public.item_ingredients
  for all using (
    exists (
      select 1 from public.inventory_items ii
      where ii.id = item_ingredients.inventory_id
        and is_staff_for_tenant(ii.tenant_id, array['owner','manager','cashier','chef','admin','support']::role_t[])
    )
  )
  with check (
    exists (
      select 1 from public.inventory_items ii
      where ii.id = item_ingredients.inventory_id
        and is_staff_for_tenant(ii.tenant_id, array['owner','manager','cashier','chef','admin','support']::role_t[])
    )
  );

drop policy if exists "Service role manages inventory" on public.inventory_items;
create policy "Service role manages inventory" on public.inventory_items
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages ingredients" on public.item_ingredients;
create policy "Service role manages ingredients" on public.item_ingredients
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Harden agent telemetry exposure
alter table if exists public.agent_events enable row level security;

drop policy if exists "Agent events visible to staff" on public.agent_events;
create policy "Agent events visible to staff" on public.agent_events
  for select using (
    is_staff_for_tenant(coalesce(tenant_id, (select tenant_id from public.locations where id = agent_events.location_id)), array['owner','manager','admin','support']::role_t[])
  );

drop policy if exists "Agent events managed by service role" on public.agent_events;
create policy "Agent events managed by service role" on public.agent_events
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Durable idempotency register for payment webhooks
create table if not exists public.payment_webhook_events (
  id uuid primary key default uuid_generate_v4(),
  provider text not null,
  event_id text not null,
  signature text,
  payload jsonb not null,
  processed_at timestamptz not null default timezone('utc', now()),
  last_status text not null default 'processed'
);

create unique index if not exists payment_webhook_events_provider_event_key
  on public.payment_webhook_events(provider, event_id);

alter table public.payment_webhook_events enable row level security;

drop policy if exists "Service role manages webhook events" on public.payment_webhook_events;
create policy "Service role manages webhook events" on public.payment_webhook_events
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Staff may view webhook audit" on public.payment_webhook_events;
create policy "Staff may view webhook audit" on public.payment_webhook_events
  for select using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.orders o
      join public.payments p on p.order_id = o.id
      where (payload ->> 'payment_id')::uuid = p.id
        and is_staff_for_tenant(o.tenant_id, array['owner','manager','admin','support']::role_t[])
    )
  );
