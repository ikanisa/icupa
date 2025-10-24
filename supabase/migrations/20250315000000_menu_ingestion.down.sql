set search_path = public, extensions;

drop trigger if exists trg_touch_menu_items_staging on public.menu_items_staging;
drop trigger if exists trg_touch_menu_ingestions on public.menu_ingestions;
drop function if exists public.touch_menu_items_staging();
drop function if exists public.touch_menu_ingestions();
drop function if exists public.publish_menu_ingestion(uuid, uuid, uuid);
drop table if exists public.menu_items_staging cascade;
drop table if exists public.menu_ingestions cascade;
drop type if exists public.menu_ingestion_status_t;
