begin;

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

DO $$
DECLARE
  match_count integer;
  top_item uuid;
  top_score double precision;
BEGIN
  select
    count(*),
    (array_agg(item_id order by similarity desc))[1],
    max(similarity)
  into match_count, top_item, top_score
  from public.search_menu_items(
    public.unit_embedding(1),
    null,
    '00000000-0000-4000-8000-000000000011',
    3,
    0.5
  );

  if match_count = 0 then
    raise exception 'Search should return at least one row when embeddings exist';
  end if;

  if top_item <> '00000000-0000-4000-8000-000000000401'::uuid then
    raise exception 'Expected Nyamirambo Chill Brew to rank first, saw %', top_item;
  end if;

  if coalesce(top_score, 0) < 0.5 then
    raise exception 'Similarity score % fell below configured threshold', top_score;
  end if;
END$$;

rollback;
