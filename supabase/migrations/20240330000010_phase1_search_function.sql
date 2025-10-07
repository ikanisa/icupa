-- Phase 1 enhancement: vector-powered menu search RPC
set search_path = public;

create or replace function public.search_menu_items(
  query_embedding vector(3072),
  target_tenant uuid default null,
  target_location uuid default null,
  match_limit integer default 8,
  min_score double precision default 0.55
)
returns table (
  item_id uuid,
  item_name text,
  item_description text,
  tenant_id uuid,
  location_id uuid,
  category_id uuid,
  price_cents integer,
  currency char(3),
  allergens text[],
  tags text[],
  is_alcohol boolean,
  similarity double precision
)
language sql
stable
as $$
  select
    i.id as item_id,
    i.name as item_name,
    coalesce(i.description, '') as item_description,
    i.tenant_id,
    i.location_id,
    i.category_id,
    coalesce(i.price_cents, 0) as price_cents,
    coalesce(i.currency, 'RWF') as currency,
    coalesce(i.allergens, '{}') as allergens,
    coalesce(i.tags, '{}') as tags,
    coalesce(i.is_alcohol, false) as is_alcohol,
    1 - (i.embedding <#> query_embedding) as similarity
  from public.items i
  where i.embedding is not null
    and coalesce(i.is_available, true)
    and (target_tenant is null or i.tenant_id = target_tenant)
    and (target_location is null or i.location_id = target_location)
    and 1 - (i.embedding <#> query_embedding) >= min_score
  order by i.embedding <#> query_embedding
  limit greatest(match_limit, 1);
$$;
