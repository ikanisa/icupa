-- Phase 1 follow-up: schedule automatic embedding refresh via pg_cron
set search_path = public;

-- Enable HTTP client capabilities for invoking Edge Functions from cron jobs
create extension if not exists http with schema extensions;

create table if not exists public.scheduler_config (
  key text primary key,
  value text not null,
  description text
);

alter table public.scheduler_config enable row level security;

create policy if not exists "Service role manages scheduler config"
  on public.scheduler_config
  for all
  using (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  )
  with check (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

insert into public.scheduler_config (key, value, description)
values (
  'menu_embed_items_url',
  'http://host.docker.internal:54321/functions/v1/menu/embed_items',
  'Edge Function endpoint invoked by pg_cron to refresh menu embeddings.'
)
on conflict (key) do nothing;

create or replace function public.invoke_menu_embedding_refresh()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_url text;
  response http_response;
begin
  select value into target_url
  from public.scheduler_config
  where key = 'menu_embed_items_url';

  if target_url is null or length(trim(target_url)) = 0 then
    raise notice 'Skipping menu embedding refresh: menu_embed_items_url not configured.';
    return;
  end if;

  response := http_post(
    target_url,
    '{}'::text,
    'application/json',
    array[
      http_header('user-agent', 'icupa-pg-cron'),
      http_header('x-icupa-cron', 'menu-embed-refresh')
    ]
  );

  if response.status >= 400 then
    raise exception 'menu/embed_items responded with status %: %', response.status, coalesce(response.content::text, '');
  end if;
end;
$$;

-- Ensure the hourly job exists exactly once
do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'menu_embed_items_hourly'
  ) then
    perform cron.schedule(
      'menu_embed_items_hourly',
      '10 * * * *',
      $$select public.invoke_menu_embedding_refresh();$$
    );
  end if;
end $$;

