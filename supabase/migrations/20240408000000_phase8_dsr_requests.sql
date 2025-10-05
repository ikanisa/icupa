set search_path = public;

create type if not exists dsr_request_type_t as enum ('export', 'delete');
create type if not exists dsr_request_status_t as enum ('queued', 'in_progress', 'completed', 'failed');

create table if not exists public.dsr_requests (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  region region_t not null,
  subject_identifier text not null,
  contact_email text,
  request_type dsr_request_type_t not null,
  status dsr_request_status_t not null default 'queued',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  requested_by uuid references auth.users(id),
  notes jsonb not null default '{}'::jsonb
);

create index if not exists idx_dsr_requests_tenant_status
  on public.dsr_requests(tenant_id, status, requested_at desc);

alter table public.dsr_requests enable row level security;

create policy if not exists "Staff read DSR requests" on public.dsr_requests
  for select using (
    tenant_id is not null
    and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

create policy if not exists "Staff insert DSR requests" on public.dsr_requests
  for insert with check (
    tenant_id is not null
    and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

create policy if not exists "Staff update DSR requests" on public.dsr_requests
  for update using (
    tenant_id is not null
    and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  )
  with check (
    tenant_id is not null
    and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

create or replace function public.touch_dsr_request()
returns trigger
language plpgsql
as $$
begin
  if new.requested_by is null then
    new.requested_by := auth.uid();
  end if;

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.status <> 'completed' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_touch_dsr_request on public.dsr_requests;

create trigger trg_touch_dsr_request
  before insert or update on public.dsr_requests
  for each row
  execute function public.touch_dsr_request();
