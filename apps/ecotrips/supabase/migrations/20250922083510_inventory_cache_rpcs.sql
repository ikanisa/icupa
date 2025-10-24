set search_path = public;

create or replace function public.inventory_get_cache(p_cache_key text)
returns setof catalog.search_cache
language sql
security definer
set search_path = catalog, public
as $$
  select *
    from catalog.search_cache
   where cache_key = p_cache_key;
$$;

grant execute on function public.inventory_get_cache(text) to service_role;

create or replace function public.inventory_upsert_cache(
  p_cache_key text,
  p_params_hash text,
  p_response jsonb,
  p_etag text,
  p_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = catalog, public
as $$
  insert into catalog.search_cache as t (cache_key, params_hash, response, etag, expires_at)
  values (p_cache_key, p_params_hash, p_response, p_etag, p_expires_at)
  on conflict (cache_key) do update set
    params_hash = excluded.params_hash,
    response = excluded.response,
    etag = excluded.etag,
    expires_at = excluded.expires_at;
$$;

grant execute on function public.inventory_upsert_cache(text, text, jsonb, text, timestamptz) to service_role;
