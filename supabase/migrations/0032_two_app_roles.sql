-- Enable role mapping for client and admin surfaces.
create schema if not exists sec;

do $$
begin
  if not exists (
    select 1 from information_schema.tables where table_schema = 'sec' and table_name = 'user_roles'
  ) then
    create table sec.user_roles (
      user_id uuid primary key references auth.users (id) on delete cascade,
      role text not null check (role in ('consumer', 'supplier', 'ops', 'admin')),
      granted_at timestamptz not null default now()
    );
  end if;
end$$;

create or replace function sec.has_role(p_role text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_user uuid := auth.uid();
  v_role text := lower(coalesce(p_role, ''));
begin
  if v_user is null then
    return false;
  end if;

  return exists (
    select 1
    from sec.user_roles r
    where r.user_id = v_user
      and r.role = v_role
  );
end;
$$;

create or replace function sec.is_ops(u uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  if u is null then
    return false;
  end if;

  return exists (
    select 1
    from sec.user_roles r
    where r.user_id = u
      and r.role in ('ops', 'admin')
  );
end;
$$;

grant usage on schema sec to authenticated;
grant select on table sec.user_roles to authenticated;

comment on table sec.user_roles is 'Role registry for ecoTrips applications (consumer, supplier, ops, admin).';
comment on function sec.has_role(text) is 'Returns true if the authenticated user has the requested role.';
comment on function sec.is_ops(uuid) is 'Checks if the provided user id is ops/admin.';
