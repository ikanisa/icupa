create or replace view public.permits_requests_view as
select
  r.id,
  r.user_id,
  r.park,
  r.visit_date,
  r.pax_count,
  r.status,
  r.note,
  r.created_at,
  r.updated_at
from permits.requests r;

grant select on public.permits_requests_view to authenticated;

create or replace function public.create_permit_request(
  p_user uuid,
  p_park text,
  p_visit date,
  p_pax int,
  p_note text
) returns permits.requests
language plpgsql
security definer
set search_path = permits, public
as $$
declare
  new_row permits.requests;
begin
  insert into permits.requests (user_id, park, visit_date, pax_count, note)
  values (p_user, p_park, p_visit, p_pax, nullif(p_note, ''))
  returning * into new_row;
  return new_row;
end;
$$;

grant execute on function public.create_permit_request(uuid, text, date, int, text) to authenticated;

create or replace function public.approve_permit_request(
  p_id uuid,
  p_note text
) returns permits.requests
language plpgsql
security definer
set search_path = permits, public
as $$
declare
  updated permits.requests;
  existing_note text;
  note_to_store text;
begin
  select note into existing_note from permits.requests where id = p_id;
  if not found then
    raise exception 'permit request not found';
  end if;

  update permits.requests
  set status = 'approved',
      note = case
        when coalesce(existing_note, '') = '' then nullif(p_note, '')
        when nullif(p_note, '') is null then existing_note
        else concat(existing_note, E'\n', p_note)
      end
  where id = p_id and status = 'pending'
  returning * into updated;

  if not found then
    raise exception 'permit request not pending';
  end if;

  return updated;
end;
$$;

grant execute on function public.approve_permit_request(uuid, text) to authenticated;

create or replace function public.reject_permit_request(
  p_id uuid,
  p_note text
) returns permits.requests
language plpgsql
security definer
set search_path = permits, public
as $$
declare
  updated permits.requests;
  existing_note text;
begin
  select note into existing_note from permits.requests where id = p_id;
  if not found then
    raise exception 'permit request not found';
  end if;

  update permits.requests
  set status = 'rejected',
      note = case
        when coalesce(existing_note, '') = '' then nullif(p_note, '')
        when nullif(p_note, '') is null then existing_note
        else concat(existing_note, E'\n', p_note)
      end
  where id = p_id and status = 'pending'
  returning * into updated;

  if not found then
    raise exception 'permit request not pending';
  end if;

  return updated;
end;
$$;

grant execute on function public.reject_permit_request(uuid, text) to authenticated;
