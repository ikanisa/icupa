-- Phase 1 hardening follow-up: extend RLS to modifier and inventory tables
set search_path = public;

alter table public.modifier_groups enable row level security;
alter table public.modifiers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.item_ingredients enable row level security;
alter table public.order_item_mods enable row level security;

-- Diner read access to modifier definitions used for cart customisation
create policy if not exists "Modifier groups readable public" on public.modifier_groups
  for select using (true);

create policy if not exists "Modifiers readable public" on public.modifiers
  for select using (true);

-- Staff management over modifier definitions
create policy if not exists "Staff manage modifier groups" on public.modifier_groups
  for all using (
    exists (
      select 1
      from public.items i
      where i.id = modifier_groups.item_id
        and is_staff_for_tenant(i.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

create policy if not exists "Staff manage modifiers" on public.modifiers
  for all using (
    exists (
      select 1
      from public.modifier_groups g
      join public.items i on i.id = g.item_id
      where g.id = modifiers.group_id
        and is_staff_for_tenant(i.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );

-- Inventory tables are staff-only
create policy if not exists "Staff manage inventory" on public.inventory_items
  for all using (
    is_staff_for_tenant(tenant_id, array['owner','manager','chef','admin']::role_t[])
  );

create policy if not exists "Staff manage item ingredients" on public.item_ingredients
  for all using (
    exists (
      select 1
      from public.inventory_items inv
      join public.items it on it.id = item_ingredients.item_id
      where inv.id = item_ingredients.inventory_id
        and is_staff_for_tenant(inv.tenant_id, array['owner','manager','chef','admin']::role_t[])
        and is_staff_for_tenant(it.tenant_id, array['owner','manager','chef','admin']::role_t[])
    )
  );

-- Diner and staff access rules for order item modifiers follow parent order permissions
create policy if not exists "Diner select order item mods" on public.order_item_mods
  for select using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_mods.order_item_id
        and o.table_session_id = public.current_table_session_id()
    )
  );

create policy if not exists "Diner insert order item mods" on public.order_item_mods
  for insert with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_mods.order_item_id
        and o.table_session_id = public.current_table_session_id()
        and o.status in ('draft','submitted')
    )
  );

create policy if not exists "Diner update order item mods" on public.order_item_mods
  for update using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_mods.order_item_id
        and o.table_session_id = public.current_table_session_id()
        and o.status in ('draft','submitted')
    )
  )
  with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_mods.order_item_id
        and o.table_session_id = public.current_table_session_id()
        and o.status in ('draft','submitted')
    )
  );

create policy if not exists "Diner delete order item mods" on public.order_item_mods
  for delete using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_mods.order_item_id
        and o.table_session_id = public.current_table_session_id()
        and o.status in ('draft','submitted')
    )
  );

create policy if not exists "Staff manage order item mods" on public.order_item_mods
  for all using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_mods.order_item_id
        and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','server','chef','kds','admin']::role_t[])
    )
  );
