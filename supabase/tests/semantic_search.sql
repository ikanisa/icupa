begin;

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

do $$
declare
  best_item uuid;
begin
  select id into best_item
  from (
    select id
    from public.items
    where embedding is not null
    order by embedding <#> public.unit_embedding(1)
    limit 1
  ) ranked;

  if best_item <> '00000000-0000-4000-8000-000000000401'::uuid then
    raise exception 'Expected Chill Brew to rank first, saw %', best_item;
  end if;
end $$;

rollback;
