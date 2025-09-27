begin;

-- Manager context should be able to seed staging rows for their tenant/location
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

insert into public.menu_ingestions (
  id,
  tenant_id,
  location_id,
  uploaded_by,
  original_filename,
  storage_path,
  file_mime,
  status,
  currency
) values (
  '00000000-0000-4000-8000-00000000f002',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-9000-0000000000bb',
  'brunch-menu.pdf',
  'raw_menus/tenant1/brunch-menu.pdf',
  'application/pdf',
  'awaiting_review',
  'RWF'
) on conflict (id) do nothing;

insert into public.menu_items_staging (
  ingestion_id,
  category_name,
  name,
  description,
  price_cents,
  currency,
  allergens,
  tags,
  is_alcohol,
  confidence
) values (
  '00000000-0000-4000-8000-00000000f002',
  'Coffee',
  'Cold Brew',
  'House cold brew concentrate.',
  3200,
  'RWF',
  '{}'::text[],
  '{coffee}'::text[],
  false,
  0.92
);

perform 1
from public.menu_items_staging mis
where mis.ingestion_id = '00000000-0000-4000-8000-00000000f002';

-- Diner context must be denied even when ingestion exists
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

do $$
begin
  begin
    perform count(*)
    from public.menu_items_staging
    where ingestion_id = '00000000-0000-4000-8000-00000000f002';
    raise exception 'Diner should not read menu_items_staging';
  exception
    when insufficient_privilege then
      null; -- expected path
  end;
end $$;

rollback;
