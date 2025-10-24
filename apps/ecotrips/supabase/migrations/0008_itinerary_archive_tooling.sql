alter table booking.itineraries
  add column if not exists is_test boolean not null default false,
  add column if not exists notes text;

create table if not exists booking.itineraries_archive (
  id uuid not null,
  user_id uuid,
  group_id uuid,
  currency text,
  total_cents bigint,
  status text,
  created_at timestamptz,
  is_test boolean,
  notes text,
  archived_at timestamptz default now()
);

create table if not exists booking.items_archive (
  id uuid not null,
  itinerary_id uuid,
  item_type text,
  supplier_ref text,
  start_at timestamptz,
  end_at timestamptz,
  pax jsonb,
  price_cents bigint,
  currency text,
  archived_at timestamptz default now()
);

create or replace function booking.archive_itineraries(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = booking, public
as $$
declare
  archived_count integer := 0;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return archived_count;
  end if;

  with moved_itineraries as (
    insert into booking.itineraries_archive (
      id,
      user_id,
      group_id,
      currency,
      total_cents,
      status,
      created_at,
      is_test,
      notes
    )
    select
      id,
      user_id,
      group_id,
      currency,
      total_cents,
      status,
      created_at,
      is_test,
      notes
    from booking.itineraries
    where id = any(p_ids)
    returning id
  )
  insert into booking.items_archive (
    id,
    itinerary_id,
    item_type,
    supplier_ref,
    start_at,
    end_at,
    pax,
    price_cents,
    currency
  )
  select
    bi.id,
    bi.itinerary_id,
    bi.item_type,
    bi.supplier_ref,
    bi.start_at,
    bi.end_at,
    bi.pax,
    bi.price_cents,
    bi.currency
  from booking.items bi
  join moved_itineraries mi on mi.id = bi.itinerary_id;

  delete from booking.items
  where itinerary_id = any(p_ids);

  delete from booking.itineraries
  where id = any(p_ids);

  get diagnostics archived_count = row_count;

  return archived_count;
end;
$$;

grant execute on function booking.archive_itineraries(uuid[]) to authenticated;
