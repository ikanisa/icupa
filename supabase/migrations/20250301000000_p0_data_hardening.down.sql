set search_path = public, extensions;

drop policy if exists "Service role manages ingredients" on public.item_ingredients;
drop policy if exists "Item ingredients follow inventory" on public.item_ingredients;
drop policy if exists "Service role manages inventory" on public.inventory_items;
drop policy if exists "Inventory managed by staff" on public.inventory_items;
drop policy if exists "Inventory visible to staff" on public.inventory_items;
alter table if exists public.item_ingredients disable row level security;
alter table if exists public.inventory_items disable row level security;

drop policy if exists "Agent events managed by service role" on public.agent_events;
drop policy if exists "Agent events visible to staff" on public.agent_events;
alter table if exists public.agent_events disable row level security;

drop policy if exists "Staff may view webhook audit" on public.payment_webhook_events;
drop policy if exists "Service role manages webhook events" on public.payment_webhook_events;
drop table if exists public.payment_webhook_events cascade;
