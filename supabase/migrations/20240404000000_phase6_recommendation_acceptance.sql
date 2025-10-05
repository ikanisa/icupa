set search_path = public;

alter table if exists public.recommendation_impressions
  alter column accepted set default false;

update public.recommendation_impressions
   set accepted = coalesce(accepted, false)
 where accepted is null;

alter table if exists public.recommendation_impressions
  alter column accepted set not null;

alter table if exists public.recommendation_impressions
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_recommendation_impressions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_recommendation_impressions on public.recommendation_impressions;
create trigger trg_touch_recommendation_impressions
  before update on public.recommendation_impressions
  for each row
  execute function public.touch_recommendation_impressions();

create or replace function public.accept_recommendation_impression(impression_id uuid)
returns public.recommendation_impressions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_session uuid;
  updated_row public.recommendation_impressions%rowtype;
begin
  active_session := public.current_table_session_id();
  if active_session is null then
    raise exception 'A valid table session is required to accept a recommendation.' using errcode = '42501';
  end if;

  update public.recommendation_impressions ri
     set accepted = true,
         updated_at = now()
   where ri.id = impression_id
     and exists (
       select 1
         from public.agent_sessions s
        where s.id = ri.session_id
          and s.table_session_id = active_session
     )
  returning ri.* into updated_row;

  if not found then
    raise exception 'Recommendation impression not found for this session.' using errcode = '42501';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.accept_recommendation_impression(uuid) from public;
grant execute on function public.accept_recommendation_impression(uuid) to anon, authenticated, service_role;

comment on function public.accept_recommendation_impression(uuid) is
  'Marks a recommendation impression as accepted when the caller provides a valid x-icupa-session header.';
