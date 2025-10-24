create schema if not exists metrics;

create table if not exists metrics.counters (
  name text primary key,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table metrics.counters enable row level security;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'metrics'
       and tablename = 'counters'
       and policyname = 'p_metrics_counters_service'
  ) then
    create policy p_metrics_counters_service on metrics.counters
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

grant select, insert, update, delete on metrics.counters to service_role;

create or replace function metrics.increment_counter(
  p_name text,
  p_delta bigint default 1
) returns metrics.counters
language plpgsql
security definer
set search_path = metrics, public
as $$
declare
  delta bigint := coalesce(p_delta, 0);
  result metrics.counters;
begin
  insert into metrics.counters(name, count, updated_at)
  values (p_name, greatest(delta, 0), now())
  on conflict (name) do update
    set count = metrics.counters.count + greatest(delta, 0),
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

grant execute on function metrics.increment_counter(text, bigint) to service_role;

create or replace function public.metrics_increment_counter(
  p_name text,
  p_delta bigint default 1
) returns metrics.counters
language plpgsql
security definer
set search_path = metrics, public
as $$
begin
  return metrics.increment_counter(p_name, p_delta);
end;
$$;

grant execute on function public.metrics_increment_counter(text, bigint) to service_role;
