set search_path = public;

-- Additional compliance governance for Phase 8
create type if not exists compliance_notice_type_t as enum ('ai_disclosure', 'privacy_notice');

create table if not exists public.compliance_notice_templates (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  region region_t not null,
  notice_type compliance_notice_type_t not null,
  surface text not null,
  content text not null,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_compliance_notice_templates_scope
  on public.compliance_notice_templates (coalesce(tenant_id, '00000000-0000-4000-8000-000000000000'::uuid), region, notice_type, surface);

create table if not exists public.kybc_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  region region_t not null,
  requirement text not null,
  status compliance_status_t not null default 'pending',
  notes jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  verified_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_kybc_checklist_tenant on public.kybc_checklist_items(tenant_id, status);

alter table public.compliance_notice_templates enable row level security;
alter table public.kybc_checklist_items enable row level security;

create or replace function public.touch_compliance_notice_template()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.updated_by is null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.touch_kybc_checklist_items()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'resolved' then
    if new.last_verified_at is null then
      new.last_verified_at := now();
    end if;
    if new.verified_by is null then
      new.verified_by := auth.uid();
    end if;
  else
    new.last_verified_at := null;
    new.verified_by := null;
  end if;
  if new.updated_by is null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_compliance_notice_template on public.compliance_notice_templates;
drop trigger if exists trg_touch_kybc_checklist_items on public.kybc_checklist_items;

create trigger trg_touch_compliance_notice_template
  before insert or update on public.compliance_notice_templates
  for each row
  execute function public.touch_compliance_notice_template();

create trigger trg_touch_kybc_checklist_items
  before insert or update on public.kybc_checklist_items
  for each row
  execute function public.touch_kybc_checklist_items();

create policy if not exists "Staff read compliance notices" on public.compliance_notice_templates
  for select using (
    tenant_id is null
    or is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

create policy if not exists "Staff manage compliance notices" on public.compliance_notice_templates
  for all using (
    tenant_id is not null
    and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  )
  with check (
    tenant_id is not null
    and is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

create policy if not exists "Staff read kybc checklist" on public.kybc_checklist_items
  for select using (
    is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

create policy if not exists "Staff manage kybc checklist" on public.kybc_checklist_items
  for all using (
    is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  )
  with check (
    is_staff_for_tenant(tenant_id, array['owner','manager','admin','support']::role_t[])
  );

create or replace function public.fiscalization_sla_summary(tenant_uuid uuid)
returns table (
  pending_count bigint,
  processing_count bigint,
  failed_count bigint,
  sla_breach_count bigint,
  oldest_pending_seconds integer,
  last_error text,
  last_error_at timestamptz,
  last_receipt_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with scoped_jobs as (
    select
      fj.status,
      fj.created_at,
      fj.last_error,
      fj.last_attempt_at,
      o.tenant_id
    from public.fiscalization_jobs fj
    join public.orders o on o.id = fj.order_id
    where o.tenant_id = tenant_uuid
      and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','admin','support']::role_t[])
  ),
  aggregates as (
    select
      coalesce(sum(case when status in ('queued','processing') then 1 else 0 end), 0)::bigint as pending_count,
      coalesce(sum(case when status = 'processing' then 1 else 0 end), 0)::bigint as processing_count,
      coalesce(sum(case when status = 'failed' then 1 else 0 end), 0)::bigint as failed_count,
      coalesce(sum(case when status in ('queued','processing') and now() - created_at > interval '5 minutes' then 1 else 0 end), 0)::bigint as sla_breach_count,
      coalesce(max(extract(epoch from now() - created_at)), 0)::integer as oldest_pending_seconds,
      max(last_error) filter (where last_error is not null) as last_error,
      max(last_attempt_at) filter (where last_error is not null) as last_error_at
    from scoped_jobs
  ),
  last_receipt as (
    select max(r.created_at) as last_receipt_at
    from public.receipts r
    join public.orders o on o.id = r.order_id
    where o.tenant_id = tenant_uuid
      and is_staff_for_tenant(o.tenant_id, array['owner','manager','cashier','admin','support']::role_t[])
  )
  select
    coalesce(a.pending_count, 0) as pending_count,
    coalesce(a.processing_count, 0) as processing_count,
    coalesce(a.failed_count, 0) as failed_count,
    coalesce(a.sla_breach_count, 0) as sla_breach_count,
    coalesce(a.oldest_pending_seconds, 0) as oldest_pending_seconds,
    a.last_error,
    a.last_error_at,
    lr.last_receipt_at
  from aggregates a
  cross join last_receipt lr;
$$;

grant execute on function public.fiscalization_sla_summary(uuid) to authenticated;
