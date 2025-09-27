-- Phase 1 identity hardening: lock down profiles and user roles
set search_path = public;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Profiles: diners and staff may manage their own row. Service role retains full control.
create policy if not exists "Profiles self access" on public.profiles
  for select using (auth.uid() = user_id);

create policy if not exists "Profiles self modify" on public.profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Profiles self insert" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy if not exists "Service role manage profiles" on public.profiles
  for all using (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
  with check (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role');

-- User roles: users can inspect their own assignments; tenant staff can review peers; only service role mutates.
create policy if not exists "User sees own roles" on public.user_roles
  for select using (auth.uid() = user_roles.user_id);

create policy if not exists "Tenant staff view roles" on public.user_roles
  for select using (
    exists (
      select 1
      from public.user_roles staff
      where staff.user_id = auth.uid()
        and staff.tenant_id = user_roles.tenant_id
        and staff.role = any(array['owner','manager','cashier','server','chef','kds','admin','support']::role_t[])
    )
  );

create policy if not exists "Service role manage user roles" on public.user_roles
  for all using (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
  with check (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role');
