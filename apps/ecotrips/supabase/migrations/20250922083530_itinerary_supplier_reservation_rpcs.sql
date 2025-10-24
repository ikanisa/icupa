create extension if not exists vector;

create schema if not exists matching;

grant usage on schema matching to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_namespace where nspname = 'matching'
  ) then
    execute 'create schema matching';
  end if;
end;
$$;

create table if not exists matching.traveler_embeddings (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null unique,
  embedding vector(1536) not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists traveler_embeddings_traveler_idx
  on matching.traveler_embeddings (traveler_id);

create index if not exists traveler_embeddings_embedding_idx
  on matching.traveler_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 50);

create table if not exists matching.supplier_embeddings (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null unique references supplier_crm.providers(id) on delete cascade,
  embedding vector(1536) not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists supplier_embeddings_supplier_idx
  on matching.supplier_embeddings (supplier_id);

create index if not exists supplier_embeddings_embedding_idx
  on matching.supplier_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 50);

create table if not exists booking.reservations (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references booking.itineraries(id) on delete cascade,
  item_id uuid references booking.items(id) on delete set null,
  supplier_ref text,
  supplier_id uuid references supplier_crm.providers(id) on delete set null,
  status text not null check (status in ('pending','confirmed','cancelled','failed')) default 'pending',
  confirmation_code text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists booking_reservations_itinerary_idx
  on booking.reservations (itinerary_id);

create index if not exists booking_reservations_supplier_idx
  on booking.reservations (supplier_id);

create or replace function matching.upsert_traveler_embedding(
  traveler_id uuid,
  embedding double precision[],
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = matching, public
as $$
declare
  v_id uuid;
  v_embedding vector(1536);
begin
  if traveler_id is null then
    raise exception 'traveler_id required';
  end if;
  if embedding is null or array_length(embedding, 1) is null then
    raise exception 'embedding required';
  end if;

  v_embedding := embedding::vector(1536);

  insert into matching.traveler_embeddings as te (
    traveler_id,
    embedding,
    metadata,
    updated_at
  )
  values (
    traveler_id,
    v_embedding,
    coalesce(metadata, '{}'::jsonb),
    now()
  )
  on conflict (traveler_id)
  do update set
    embedding = excluded.embedding,
    metadata = coalesce(te.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function matching.upsert_traveler_embedding(uuid, double precision[], jsonb) to authenticated;

create or replace function matching.upsert_supplier_embedding(
  supplier_id uuid,
  embedding double precision[],
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = matching, public
as $$
declare
  v_id uuid;
  v_embedding vector(1536);
begin
  if supplier_id is null then
    raise exception 'supplier_id required';
  end if;
  if embedding is null or array_length(embedding, 1) is null then
    raise exception 'embedding required';
  end if;

  v_embedding := embedding::vector(1536);

  insert into matching.supplier_embeddings as se (
    supplier_id,
    embedding,
    metadata,
    updated_at
  )
  values (
    supplier_id,
    v_embedding,
    coalesce(metadata, '{}'::jsonb),
    now()
  )
  on conflict (supplier_id)
  do update set
    embedding = excluded.embedding,
    metadata = coalesce(se.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function matching.upsert_supplier_embedding(uuid, double precision[], jsonb) to authenticated;

create or replace function matching.match_suppliers_by_intent(
  embedding double precision[],
  match_limit integer default 5
)
returns table (
  supplier_id uuid,
  supplier_name text,
  score double precision,
  metadata jsonb
)
language plpgsql
set search_path = matching, supplier_crm, public
as $$
declare
  v_embedding vector(1536);
  v_limit integer := greatest(1, least(coalesce(match_limit, 5), 50));
begin
  if embedding is null or array_length(embedding, 1) is null then
    return;
  end if;

  v_embedding := embedding::vector(1536);

  return query
    select
      se.supplier_id,
      sp.name,
      1 - (se.embedding <=> v_embedding) as score,
      se.metadata
    from matching.supplier_embeddings se
    left join supplier_crm.providers sp on sp.id = se.supplier_id
    order by se.embedding <=> v_embedding
    limit v_limit;
end;
$$;

grant execute on function matching.match_suppliers_by_intent(double precision[], integer) to authenticated;

create or replace function matching.match_travelers_by_intent(
  embedding double precision[],
  match_limit integer default 5
)
returns table (
  traveler_id uuid,
  score double precision,
  metadata jsonb
)
language plpgsql
set search_path = matching, public
as $$
declare
  v_embedding vector(1536);
  v_limit integer := greatest(1, least(coalesce(match_limit, 5), 50));
begin
  if embedding is null or array_length(embedding, 1) is null then
    return;
  end if;

  v_embedding := embedding::vector(1536);

  return query
    select
      te.traveler_id,
      1 - (te.embedding <=> v_embedding) as score,
      te.metadata
    from matching.traveler_embeddings te
    order by te.embedding <=> v_embedding
    limit v_limit;
end;
$$;

grant execute on function matching.match_travelers_by_intent(double precision[], integer) to authenticated;

create or replace function matching.match_suppliers_for_traveler(
  traveler_id uuid,
  match_limit integer default 5
)
returns table (
  supplier_id uuid,
  supplier_name text,
  score double precision,
  metadata jsonb
)
language plpgsql
set search_path = matching, supplier_crm, public
as $$
declare
  v_embedding vector(1536);
  v_limit integer := greatest(1, least(coalesce(match_limit, 5), 50));
begin
  if traveler_id is null then
    return;
  end if;

  select te.embedding
  into v_embedding
  from matching.traveler_embeddings te
  where te.traveler_id = traveler_id;

  if v_embedding is null then
    return;
  end if;

  return query
    select
      se.supplier_id,
      sp.name,
      1 - (se.embedding <=> v_embedding) as score,
      se.metadata
    from matching.supplier_embeddings se
    left join supplier_crm.providers sp on sp.id = se.supplier_id
    order by se.embedding <=> v_embedding
    limit v_limit;
end;
$$;

grant execute on function matching.match_suppliers_for_traveler(uuid, integer) to authenticated;

create or replace function matching.match_travelers_for_traveler(
  traveler_id uuid,
  match_limit integer default 5
)
returns table (
  traveler_id uuid,
  score double precision,
  metadata jsonb
)
language plpgsql
set search_path = matching, public
as $$
declare
  v_embedding vector(1536);
  v_limit integer := greatest(1, least(coalesce(match_limit, 5), 50));
begin
  if traveler_id is null then
    return;
  end if;

  select te.embedding
  into v_embedding
  from matching.traveler_embeddings te
  where te.traveler_id = traveler_id;

  if v_embedding is null then
    return;
  end if;

  return query
    select
      other.traveler_id,
      1 - (other.embedding <=> v_embedding) as score,
      other.metadata
    from matching.traveler_embeddings other
    where other.traveler_id <> traveler_id
    order by other.embedding <=> v_embedding
    limit v_limit;
end;
$$;

grant execute on function matching.match_travelers_for_traveler(uuid, integer) to authenticated;

create or replace function booking.ensure_reservation(
  itinerary_id uuid,
  item_id uuid,
  supplier_ref text,
  supplier_id uuid,
  confirmation_code text,
  status text default 'pending',
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = booking, public
as $$
declare
  v_id uuid;
  v_status text := coalesce(status, 'pending');
begin
  if itinerary_id is null then
    raise exception 'itinerary_id required';
  end if;

  if v_status not in ('pending','confirmed','cancelled','failed') then
    raise exception 'invalid reservation status %', v_status;
  end if;

  select id
  into v_id
  from booking.reservations
  where itinerary_id = itinerary_id
    and coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(confirmation_code, '') = coalesce(booking.reservations.confirmation_code, '');

  if v_id is null then
    insert into booking.reservations (
      itinerary_id,
      item_id,
      supplier_ref,
      supplier_id,
      status,
      confirmation_code,
      metadata,
      updated_at
    )
    values (
      itinerary_id,
      item_id,
      nullif(supplier_ref, ''),
      supplier_id,
      v_status,
      nullif(confirmation_code, ''),
      coalesce(metadata, '{}'::jsonb),
      now()
    )
    returning id into v_id;
  else
    update booking.reservations
    set
      supplier_ref = coalesce(nullif(supplier_ref, ''), booking.reservations.supplier_ref),
      supplier_id = coalesce(supplier_id, booking.reservations.supplier_id),
      status = v_status,
      confirmation_code = coalesce(nullif(confirmation_code, ''), booking.reservations.confirmation_code),
      metadata = coalesce(booking.reservations.metadata, '{}'::jsonb) || coalesce(metadata, '{}'::jsonb),
      updated_at = now()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function booking.ensure_reservation(uuid, uuid, text, uuid, text, text, jsonb) to authenticated;

create or replace function booking.assemble_itinerary(
  user_id uuid,
  currency text default 'USD',
  items jsonb default '[]'::jsonb,
  notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = booking, public
as $$
declare
  v_itinerary_id uuid;
  v_currency text := coalesce(nullif(currency, ''), 'USD');
  v_total bigint := 0;
  v_item jsonb;
  v_item_id uuid;
  v_item_ids uuid[] := '{}';
  v_item_type text;
  v_supplier_ref text;
  v_start timestamptz;
  v_end timestamptz;
  v_price bigint;
  v_item_currency text;
  v_pax jsonb;
begin
  insert into booking.itineraries (
    user_id,
    currency,
    total_cents,
    status,
    notes
  )
  values (
    user_id,
    v_currency,
    0,
    'draft',
    notes
  )
  returning id into v_itinerary_id;

  if items is null then
    items := '[]'::jsonb;
  end if;

  for v_item in
    select value from jsonb_array_elements(items)
  loop
    v_item_type := lower(coalesce(coalesce(v_item->>'item_type', v_item->>'itemType'), 'other'));
    if v_item_type not in ('hotel','tour','transfer','permit','other') then
      v_item_type := 'other';
    end if;

    v_supplier_ref := nullif(coalesce(v_item->>'supplier_ref', v_item->>'supplierRef'), '');
    v_start := nullif(coalesce(v_item->>'start_at', v_item->>'startAt'), '')::timestamptz;
    v_end := nullif(coalesce(v_item->>'end_at', v_item->>'endAt'), '')::timestamptz;
    v_price := coalesce((nullif(coalesce(v_item->>'price_cents', v_item->>'priceCents'), ''))::bigint, 0);
    v_item_currency := coalesce(nullif(coalesce(v_item->>'currency', v_item->>'currencyCode'), ''), v_currency);
    v_pax := coalesce(v_item->'pax', '[]'::jsonb);

    insert into booking.items (
      itinerary_id,
      item_type,
      supplier_ref,
      start_at,
      end_at,
      pax,
      price_cents,
      currency
    )
    values (
      v_itinerary_id,
      v_item_type,
      v_supplier_ref,
      v_start,
      v_end,
      v_pax,
      v_price,
      v_item_currency
    )
    returning id into v_item_id;

    v_item_ids := array_append(v_item_ids, v_item_id);
    v_total := v_total + coalesce(v_price, 0);
  end loop;

  update booking.itineraries
  set total_cents = v_total,
      currency = v_currency
  where id = v_itinerary_id;

  return jsonb_build_object(
    'itinerary_id', v_itinerary_id,
    'item_ids', v_item_ids,
    'currency', v_currency,
    'total_cents', v_total
  );
end;
$$;

grant execute on function booking.assemble_itinerary(uuid, text, jsonb, text) to authenticated;
