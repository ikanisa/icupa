set search_path = public, extensions;

-- Revert inventory additions
alter table if exists public.inventory_items
  drop column if exists reorder_threshold,
  drop column if exists auto_86,
  drop column if exists auto_86_level;

-- Remove promo + copy review tables
drop policy if exists "Staff review promo audits" on public.promo_audit_events;
drop policy if exists "Service role manage promo audits" on public.promo_audit_events;
drop table if exists public.promo_audit_events cascade;

drop policy if exists "Staff manage promo campaigns" on public.promo_campaigns;
drop policy if exists "Staff read promo campaigns" on public.promo_campaigns;
drop policy if exists "Service role manage promo campaigns" on public.promo_campaigns;
drop table if exists public.promo_campaigns cascade;

drop table if exists public.menu_copy_suggestions cascade;

drop policy if exists "Staff manage tables state" on public.tables;
drop policy if exists "Staff insert table state events" on public.table_state_events;
drop policy if exists "Staff read table states" on public.table_state_events;
drop table if exists public.table_state_events cascade;

alter table if exists public.tables
  drop column if exists state,
  drop column if exists layout;

drop type if exists public.table_state_t;
drop type if exists public.copy_review_status_t;
drop type if exists public.promo_status_t;
