set search_path = public, extensions;

create table if not exists public.dsr_requests (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('export','delete')),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  requested_by text,
  rationale text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create index if not exists dsr_requests_tenant_status_idx on public.dsr_requests(tenant_id, status);

alter table public.dsr_requests enable row level security;

drop policy if exists "Service role manages dsr requests" on public.dsr_requests;
create policy "Service role manages dsr requests" on public.dsr_requests
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Staff view dsr requests" on public.dsr_requests;
create policy "Staff view dsr requests" on public.dsr_requests
  for select using (
    tenant_id is null
      or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );
