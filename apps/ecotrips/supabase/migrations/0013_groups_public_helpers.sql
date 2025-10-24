create or replace view public.group_members_view as
select id, group_id, user_id, role, joined_at
from "group".members;

grant select on public.group_members_view to authenticated;

create or replace view public.group_escrows_view as
select id, group_id, itinerary_id, currency, target_cents, min_members, deadline, status, created_at
from "group".escrows;

grant select on public.group_escrows_view to authenticated;

create or replace view public.group_contributions_view as
select id, escrow_id, member_id, amount_cents, currency, payment_id, created_at
from "group".contributions;

grant select on public.group_contributions_view to authenticated;

create or replace function public.create_group_membership(
  p_group uuid,
  p_user uuid,
  p_role text default 'member'
) returns "group".members
language plpgsql
security definer
set search_path = "group", public
as $$
declare
  inserted "group".members;
begin
  insert into "group".members (group_id, user_id, role)
  values (p_group, p_user, coalesce(p_role, 'member'))
  on conflict (group_id, user_id) do update set role = excluded.role
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.create_group_membership(uuid, uuid, text) to authenticated;

create or replace function public.create_group_escrow(
  p_group uuid,
  p_itinerary uuid,
  p_currency text,
  p_target bigint,
  p_min_members int,
  p_deadline timestamptz
) returns "group".escrows
language plpgsql
security definer
set search_path = "group", public
as $$
declare
  inserted "group".escrows;
begin
  insert into "group".escrows (group_id, itinerary_id, currency, target_cents, min_members, deadline)
  values (p_group, p_itinerary, coalesce(p_currency, 'USD'), p_target, p_min_members, p_deadline)
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.create_group_escrow(uuid, uuid, text, bigint, int, timestamptz) to authenticated;

create or replace function public.insert_group_contribution(
  p_escrow uuid,
  p_member uuid,
  p_amount bigint,
  p_currency text,
  p_payment uuid
) returns "group".contributions
language plpgsql
security definer
set search_path = "group", public
as $$
declare
  inserted "group".contributions;
begin
  insert into "group".contributions (escrow_id, member_id, amount_cents, currency, payment_id)
  values (p_escrow, p_member, p_amount, coalesce(p_currency, 'USD'), p_payment)
  returning * into inserted;
  return inserted;
end;
$$;

grant execute on function public.insert_group_contribution(uuid, uuid, bigint, text, uuid) to authenticated;

create or replace function public.group_contribution_summary(
  p_escrow uuid
) returns table(total bigint, member_count int)
language sql
security definer
set search_path = "group", public
as $$
  select coalesce(sum(amount_cents), 0) as total,
         count(distinct member_id) as member_count
  from "group".contributions
  where escrow_id = p_escrow;
$$;

grant execute on function public.group_contribution_summary(uuid) to authenticated;
