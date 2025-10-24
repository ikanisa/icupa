-- Supplier trust badges table for marketing and admin surfaces.
-- Depends on 0034_ops_console_feature_flags.sql for ops role conventions.

create table if not exists public.trust_badges (
  id uuid primary key default gen_random_uuid(),
  supplier_slug text not null,
  code text not null,
  label text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.trust_badges is 'Trust and sustainability badges displayed on marketing surfaces and editable by ops.';
comment on column public.trust_badges.supplier_slug is 'Slug identifier for supplier (lowercase, hyphenated).';
comment on column public.trust_badges.code is 'Unique badge code per supplier.';
comment on column public.trust_badges.label is 'Badge label shown to end users.';
comment on column public.trust_badges.description is 'Tooltip copy surfaced in web clients.';

create unique index if not exists trust_badges_supplier_code_idx
  on public.trust_badges (supplier_slug, code);

alter table public.trust_badges enable row level security;

create policy trust_badges_public_read on public.trust_badges
  for select
  using (active);

create policy trust_badges_ops_insert on public.trust_badges
  for insert
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)
      ) as role(value)
      where lower(role.value) in ('ops', 'admin')
    )
  );

create policy trust_badges_ops_update on public.trust_badges
  for update
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)
      ) as role(value)
      where lower(role.value) in ('ops', 'admin')
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)
      ) as role(value)
      where lower(role.value) in ('ops', 'admin')
    )
  );

grant select on table public.trust_badges to anon;
grant select, insert, update on table public.trust_badges to authenticated;
grant all on table public.trust_badges to service_role;

insert into public.trust_badges (supplier_slug, code, label, description)
values
  ('aurora-expeditions', 'gstc', 'GSTC member', 'Certified under Global Sustainable Tourism Council criteria.'),
  ('aurora-expeditions', 'offset', 'Climate offset partner', 'Contributes 3% of bookings to verified carbon projects.'),
  ('aurora-expeditions', 'community', 'Community co-op', 'Revenue share with local guides and rangers.'),
  ('rainforest-alliance', 'safety', 'Rescue-certified guides', 'All canopy guides hold rope rescue and wilderness certifications.'),
  ('rainforest-alliance', 'offset', 'Climate offset partner', 'Portion of proceeds fund native reforestation.');
