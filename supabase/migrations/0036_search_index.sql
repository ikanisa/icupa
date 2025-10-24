create schema if not exists catalog;

create table if not exists catalog.search_index (
  slug text primary key,
  entity_type text not null,
  entity_id text not null,
  title text not null,
  subtitle text,
  keywords text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(keywords, ' ')), 'C') ||
    setweight(to_tsvector('simple', coalesce(metadata->>'summary', '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_search_index_entity on catalog.search_index (entity_type, entity_id);
create index if not exists idx_search_index_vector on catalog.search_index using gin (search_vector);

create or replace function catalog.set_search_index_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgname = 'trg_catalog_search_index_updated_at'
  ) then
    create trigger trg_catalog_search_index_updated_at
      before update on catalog.search_index
      for each row execute function catalog.set_search_index_updated_at();
  end if;
end
$$;

alter table catalog.search_index enable row level security;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'catalog'
       and tablename = 'search_index'
       and policyname = 'p_search_index_service'
  ) then
    create policy p_search_index_service on catalog.search_index
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

grant select, insert, update, delete on catalog.search_index to service_role;
