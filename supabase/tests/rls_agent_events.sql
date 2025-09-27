begin;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

-- diners should be blocked

do $$
begin
  begin
    perform count(*) from public.agent_events;
    raise exception 'Diner should not access agent events';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

-- staff member should be allowed
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

perform 1 from public.agent_events limit 1;

rollback;
