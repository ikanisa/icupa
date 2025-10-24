set search_path = public, extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'menu_embed_items_hourly') then
    perform cron.unschedule('menu_embed_items_hourly');
  end if;
end;
$$;

drop function if exists public.invoke_menu_embedding_refresh() cascade;
drop policy if exists "Service role manages scheduler config" on public.scheduler_config;
drop table if exists public.scheduler_config cascade;
drop extension if exists http;
