-- Additional ops console read models for two-app architecture.
set search_path = public;

create or replace view ops.v_groups_escrows as
select
  e.id as escrow_id,
  g.name as group_name,
  e.target_cents,
  e.currency,
  e.deadline,
  e.status,
  coalesce(sum(c.amount_cents), 0) as contributed_cents,
  count(distinct m.id) as member_count
from "group".escrows e
left join "group".groups g on g.id = e.group_id
left join "group".contributions c on c.escrow_id = e.id
left join "group".members m on m.group_id = e.group_id
group by e.id, g.name, e.target_cents, e.currency, e.deadline, e.status;

grant select on ops.v_groups_escrows to authenticated;

create or replace view ops.v_permits as
select
  r.id,
  r.user_id,
  r.park,
  r.visit_date,
  r.pax_count,
  r.status,
  r.updated_at
from permits.requests r;

grant select on ops.v_permits to authenticated;

create or replace view ops.v_finance_ledger as
select
  l.id,
  l.occurred_at,
  l.entry_type,
  l.amount_cents,
  l.currency,
  coalesce(l.provider_ref, '') as provider_ref,
  coalesce(l.note, '') as note
from fin.ledger l;

grant select on ops.v_finance_ledger to authenticated;

create or replace view ops.v_privacy_requests as
select
  r.id,
  r.kind,
  r.status,
  r.requester_user_id,
  r.subject_user_id,
  r.reason,
  r.created_at,
  r.updated_at
from privacy.requests r;

grant select on ops.v_privacy_requests to authenticated;

create or replace view ops.v_dr_snapshots as
select
  s.id,
  s.label,
  s.object_path,
  s.tables,
  s.bytes,
  s.created_at,
  s.created_by,
  json_agg(json_build_object('check_name', rc.check_name, 'ok', rc.ok, 'details', rc.details))
    filter (where rc.id is not null) as restore_checks
from dr.snapshots s
left join dr.restore_checks rc on rc.snapshot_id = s.id
group by s.id;

grant select on ops.v_dr_snapshots to authenticated;
