create schema if not exists permits;

create table if not exists permits.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  park text not null check (park in ('Volcanoes','Nyungwe','Akagera')),
  visit_date date not null,
  pax_count int not null check (pax_count > 0),
  status text not null check (status in ('pending','approved','rejected','cancelled')) default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function permits.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_permits_requests_updated_at'
      and tgrelid = 'permits.requests'::regclass
  ) then
    create trigger trg_permits_requests_updated_at
      before update on permits.requests
      for each row
      execute function permits.set_updated_at();
  end if;
end
$$;

alter table permits.requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_permits_insert_self'
      and schemaname = 'permits'
      and tablename = 'requests'
  ) then
    create policy p_permits_insert_self on permits.requests
      for insert
      with check (
        (auth.uid() is not null and auth.uid() = user_id) or user_id is null
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_permits_select_self'
      and schemaname = 'permits'
      and tablename = 'requests'
  ) then
    create policy p_permits_select_self on permits.requests
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_permits_update_self'
      and schemaname = 'permits'
      and tablename = 'requests'
  ) then
    create policy p_permits_update_self on permits.requests
      for update
      using (auth.uid() = user_id and status = 'pending')
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_permits_select_ops'
      and schemaname = 'permits'
      and tablename = 'requests'
  ) then
    create policy p_permits_select_ops on permits.requests
      for select
      using (sec.is_ops(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_permits_update_ops'
      and schemaname = 'permits'
      and tablename = 'requests'
  ) then
    create policy p_permits_update_ops on permits.requests
      for update
      using (sec.is_ops(auth.uid()))
      with check (sec.is_ops(auth.uid()));
  end if;
end
$$;

grant usage on schema permits to authenticated;
grant select, insert, update on permits.requests to authenticated;
