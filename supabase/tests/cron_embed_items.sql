begin;

do $$
begin
  if not exists (
    select 1 from public.scheduler_config where key = 'menu_embed_items_url'
  ) then
    raise exception 'menu_embed_items_url scheduler config row is missing';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'menu_embed_items_hourly'
  ) then
    raise exception 'menu_embed_items_hourly cron job is not registered';
  end if;
end $$;

rollback;
