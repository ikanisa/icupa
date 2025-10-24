-- Supplier onboarding intake queue, audit log, and offline coverage read models.
set search_path = public;

create schema if not exists ops;

create table if not exists ops.supplier_onboarding_queue (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_name text,
  contact_email text not null,
  contact_phone text,
  region text,
  onboarding_stage text not null,
  status text not null default 'pending',
  priority smallint not null default 3 check (priority between 1 and 5),
  assigned_admin text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_touch_at timestamptz,
  compliance_score numeric(5,2) not null default 0,
  docs_received jsonb not null default '[]'::jsonb,
  notes text,
  constraint supplier_onboarding_stage_check
    check (onboarding_stage in (
      'intake',
      'kyc-review',
      'contracting',
      'integration',
      'ready'
    )),
  constraint supplier_onboarding_status_check
    check (status in (
      'pending',
      'in_progress',
      'blocked',
      'completed'
    ))
);

create table if not exists ops.supplier_onboarding_audits (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references ops.supplier_onboarding_queue(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists supplier_onboarding_queue_stage_idx
  on ops.supplier_onboarding_queue (onboarding_stage, status);

create index if not exists supplier_onboarding_queue_priority_idx
  on ops.supplier_onboarding_queue (priority desc, submitted_at desc);

create table if not exists ops.offline_coverage_regions (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  country_code text not null,
  availability_percent numeric(5,2) not null,
  offline_suppliers integer not null default 0,
  sample_size integer not null default 0,
  updated_at timestamptz not null default now(),
  incident_notes text,
  constraint offline_coverage_percent_check
    check (availability_percent between 0 and 100),
  constraint offline_coverage_sample_check
    check (sample_size >= 0 and offline_suppliers >= 0)
);

alter table ops.supplier_onboarding_queue enable row level security;
alter table ops.supplier_onboarding_audits enable row level security;
alter table ops.offline_coverage_regions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'ops'
      and tablename = 'supplier_onboarding_queue'
      and policyname = 'supplier_onboarding_queue_read'
  ) then
    create policy supplier_onboarding_queue_read on ops.supplier_onboarding_queue
      for select using (auth.role() = 'service_role' or coalesce(auth.jwt() ->> 'role', '') = 'authenticated')
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'ops'
      and tablename = 'supplier_onboarding_audits'
      and policyname = 'supplier_onboarding_audits_read'
  ) then
    create policy supplier_onboarding_audits_read on ops.supplier_onboarding_audits
      for select using (auth.role() = 'service_role');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'ops'
      and tablename = 'offline_coverage_regions'
      and policyname = 'offline_coverage_regions_read'
  ) then
    create policy offline_coverage_regions_read on ops.offline_coverage_regions
      for select using (auth.role() = 'service_role' or coalesce(auth.jwt() ->> 'role', '') = 'authenticated');
  end if;
end$$;

create or replace view ops.v_supplier_onboarding_queue as
select
  q.id,
  q.supplier_name,
  coalesce(q.contact_name, '') as contact_name,
  q.contact_email,
  coalesce(q.contact_phone, '') as contact_phone,
  coalesce(q.region, '') as region,
  q.onboarding_stage,
  q.status,
  q.priority,
  coalesce(q.assigned_admin, '') as assigned_admin,
  q.submitted_at,
  q.updated_at,
  coalesce(q.last_touch_at, q.updated_at) as last_touch_at,
  q.compliance_score,
  q.docs_received,
  coalesce(q.notes, '') as notes,
  extract(epoch from (now() - q.submitted_at)) / 3600 as hours_open,
  extract(epoch from (now() - coalesce(q.last_touch_at, q.updated_at))) / 3600 as hours_since_touch
from ops.supplier_onboarding_queue q;

grant select on ops.v_supplier_onboarding_queue to authenticated;

grant usage on schema ops to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_views
    where schemaname = 'ops'
      and viewname = 'v_supplier_onboarding_stage_summary'
  ) then
    execute $$
      create view ops.v_supplier_onboarding_stage_summary as
      select
        onboarding_stage,
        status,
        count(*) as total,
        avg(priority)::numeric(10,2) as avg_priority,
        percentile_cont(0.5) within group (order by extract(epoch from (now() - submitted_at)) / 3600) as median_hours_open
      from ops.supplier_onboarding_queue
      group by onboarding_stage, status;
    $$;
  else
    create or replace view ops.v_supplier_onboarding_stage_summary as
    select
      onboarding_stage,
      status,
      count(*) as total,
      avg(priority)::numeric(10,2) as avg_priority,
      percentile_cont(0.5) within group (order by extract(epoch from (now() - submitted_at)) / 3600) as median_hours_open
    from ops.supplier_onboarding_queue
    group by onboarding_stage, status;
  end if;
end$$;

grant select on ops.v_supplier_onboarding_stage_summary to authenticated;

create or replace view ops.v_offline_coverage as
select
  r.id,
  r.region,
  r.country_code,
  r.availability_percent,
  r.offline_suppliers,
  r.sample_size,
  r.updated_at,
  coalesce(r.incident_notes, '') as incident_notes,
  case
    when r.availability_percent >= 95 then 'healthy'
    when r.availability_percent >= 85 then 'watch'
    else 'degraded'
  end as health_label
from ops.offline_coverage_regions r;

grant select on ops.v_offline_coverage to authenticated;

insert into ops.supplier_onboarding_queue as q (
  supplier_name,
  contact_name,
  contact_email,
  contact_phone,
  region,
  onboarding_stage,
  status,
  priority,
  assigned_admin,
  compliance_score,
  docs_received,
  notes
)
values
  (
    'Kivu Treks',
    'Ange Uwimana',
    'ange@kivutreks.rw',
    '+250 784 123 456',
    'Rwanda',
    'kyc-review',
    'in_progress',
    2,
    'leon@ecotrips.africa',
    72.5,
    jsonb_build_array('trade_license', 'bank_letter'),
    'Awaiting proof-of-funds letter from BK.'
  ),
  (
    'Sahara Stays',
    'Laila Benyoussef',
    'laila@saharastays.ma',
    '+212 661 234 567',
    'Morocco',
    'intake',
    'pending',
    3,
    null,
    15.0,
    jsonb_build_array('questionnaire'),
    'Needs intro call scheduled.'
  ),
  (
    'Serengeti Mobile Camps',
    'Samuel Ekweme',
    'samuel@serengetimobile.co.tz',
    '+255 754 345 678',
    'Tanzania',
    'integration',
    'blocked',
    1,
    'amina@ecotrips.africa',
    64.0,
    jsonb_build_array('trade_license', 'insurance_certificate'),
    'Inventory feed failing checksum validation.'
  )
  on conflict (id) do update
    set supplier_name = excluded.supplier_name;

insert into ops.offline_coverage_regions as r (
  region,
  country_code,
  availability_percent,
  offline_suppliers,
  sample_size,
  incident_notes
)
values
  ('Kigali', 'RW', 96.5, 1, 22, 'Only one WhatsApp supplier retrying webhooks.'),
  ('Musanze', 'RW', 82.0, 3, 17, 'Safari guides impacted by fiber cut.'),
  ('Goma', 'CD', 74.5, 4, 11, 'Cross-border SIM swap triggered manual failsafe.')
  on conflict (id) do update
    set availability_percent = excluded.availability_percent;
