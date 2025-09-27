begin;

-- Diner attempting to access inventory should be denied
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

do $$
begin
  begin
    perform count(*) from public.inventory_items;
    raise exception 'Diner should not access inventory';
  exception
    when insufficient_privilege then
      -- expected path
      null;
  end;
end $$;

-- Manager should be able to access inventory for their tenant
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

-- seeds grant manager role for both tenants; confirm visibility exists
perform 1 from public.inventory_items limit 1;

rollback;
