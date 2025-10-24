-- Disaster Recovery metadata registry
set search_path = public;

create schema if not exists dr;

create table if not exists dr.snapshots (
  id uuid primary key default gen_random_uuid(),
  label text,
  tables text[] not null,
  object_path text not null,
  bytes bigint,
  sha256 text,
  created_at timestamptz default now(),
  created_by text default 'unknown'
);

create table if not exists dr.restore_checks (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references dr.snapshots(id) on delete cascade,
  check_name text,
  ok boolean,
  details jsonb,
  created_at timestamptz default now()
);

create index if not exists dr_restore_checks_snapshot_idx
  on dr.restore_checks(snapshot_id);
