begin;

-- Manager context should allow inserting and reading menu ingestions
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
  '00000000-0000-4000-8000-00000000f001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-9000-0000000000bb',
  'evening-menu.pdf',
  'raw_menus/tenant1/evening-menu.pdf',
  'application/pdf',
  'uploaded',
  'RWF'
) on conflict (id) do nothing;

perform 1
from public.menu_ingestions mi
where mi.id = '00000000-0000-4000-8000-00000000f001';

-- Diner context should be denied
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

do $$
begin
  begin
    perform count(*)
    from public.menu_ingestions
    where id = '00000000-0000-4000-8000-00000000f001';
    raise exception 'Diner should not read menu_ingestions';
  exception
    when insufficient_privilege then
      null; -- expected path
  end;
end $$;

rollback;
