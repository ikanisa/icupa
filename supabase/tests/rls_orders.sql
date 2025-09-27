begin;

-- Simulate diner context bound to Kigali table session
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000601"}';

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.orders;
  if visible_count <> 1 then
    raise exception 'Diner should see exactly 1 order, saw %', visible_count;
  end if;
end $$;

-- Reset headers for another session to confirm zero visibility
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000602"}';

do $$
declare
  foreign_count integer;
begin
  select count(*) into foreign_count
  from public.orders
  where table_session_id = '00000000-0000-4000-8000-000000000601';
  if foreign_count <> 0 then
    raise exception 'Diner should not see foreign orders, saw %', foreign_count;
  end if;
end $$;

-- Staff member with manager role should see both orders for tenant 1 and 2
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.headers" = '{}';

do $$
declare
  tenant_count integer;
begin
  select count(distinct tenant_id) into tenant_count from public.orders;
  if tenant_count <> 2 then
    raise exception 'Staff should see two tenant orders, saw %', tenant_count;
  end if;
end $$;

rollback;
