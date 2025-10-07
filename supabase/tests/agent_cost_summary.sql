begin;

set local role service_role;

insert into public.tenants (id, name, region)
values (
  '00000000-0000-4000-9000-000000000060',
  'Agent Spend Tenant',
  'EU'
) on conflict (id) do nothing;

insert into public.user_roles (user_id, tenant_id, role)
values
  ('00000000-0000-4000-9000-000000000061', '00000000-0000-4000-9000-000000000060', 'manager'),
  ('00000000-0000-4000-9000-000000000062', '00000000-0000-4000-9000-000000000060', 'diner')
on conflict do nothing;

insert into public.agent_sessions (id, agent_type, tenant_id, context)
values
  ('00000000-0000-4000-9000-000000000063', 'waiter', '00000000-0000-4000-9000-000000000060', '{"language":"en"}'),
  ('00000000-0000-4000-9000-000000000064', 'upsell_pairing', '00000000-0000-4000-9000-000000000060', '{"language":"en"}')
on conflict do nothing;

insert into public.agent_events (
  id,
  agent_type,
  session_id,
  tenant_id,
  cost_usd,
  created_at
) values
  ('00000000-0000-4000-9000-000000000071', 'waiter', '00000000-0000-4000-9000-000000000063', '00000000-0000-4000-9000-000000000060', 0.015, now() - interval '2 hours'),
  ('00000000-0000-4000-9000-000000000072', 'waiter', '00000000-0000-4000-9000-000000000063', '00000000-0000-4000-9000-000000000060', 0.045, now() - interval '3 days'),
  ('00000000-0000-4000-9000-000000000073', 'waiter', '00000000-0000-4000-9000-000000000063', '00000000-0000-4000-9000-000000000060', 0.100, now() - interval '9 days'),
  ('00000000-0000-4000-9000-000000000074', 'upsell_pairing', '00000000-0000-4000-9000-000000000064', '00000000-0000-4000-9000-000000000060', 0.020, now() - interval '1 hours'),
  ('00000000-0000-4000-9000-000000000075', 'upsell_pairing', '00000000-0000-4000-9000-000000000064', '00000000-0000-4000-9000-000000000060', 0.030, now() - interval '40 days')
on conflict do nothing;

DO $$
DECLARE
  waiter record;
  upsell record;
BEGIN
  select *
    into waiter
    from public.agent_cost_summary('00000000-0000-4000-9000-000000000060', 14)
   where agent_type = 'waiter';

  if waiter.runs_24h <> 1 then
    raise exception 'Expected one waiter run in last 24h, got %', waiter.runs_24h;
  end if;

  if abs(waiter.spend_24h_usd - 0.015) > 0.0001 then
    raise exception 'Unexpected 24h spend %', waiter.spend_24h_usd;
  end if;

  if waiter.runs_7d <> 2 then
    raise exception 'Expected two waiter runs in 7d window, got %', waiter.runs_7d;
  end if;

  if abs(waiter.spend_7d_usd - 0.060) > 0.0001 then
    raise exception 'Unexpected 7d spend %', waiter.spend_7d_usd;
  end if;

  if waiter.runs_window <> 3 then
    raise exception 'Expected three waiter runs in custom window, got %', waiter.runs_window;
  end if;

  if abs(waiter.spend_window_usd - 0.175) > 0.0001 then
    raise exception 'Unexpected window spend %', waiter.spend_window_usd;
  end if;

  select *
    into upsell
    from public.agent_cost_summary('00000000-0000-4000-9000-000000000060', 14)
   where agent_type = 'upsell_pairing';

  if upsell.runs_24h <> 1 or abs(upsell.spend_24h_usd - 0.020) > 0.0001 then
    raise exception 'Upsell 24h metrics did not match expectations';
  end if;

  if upsell.runs_7d <> 1 then
    raise exception 'Upsell should only count one run inside 7d window';
  end if;

  if upsell.runs_window <> 1 then
    raise exception 'Older upsell run should be outside custom window';
  end if;
END $$;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-000000000062';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

DO $$
BEGIN
  begin
    perform public.agent_cost_summary('00000000-0000-4000-9000-000000000060', 14);
    raise exception 'Expected non-staff user to be blocked';
  exception
    when others then
      if sqlstate <> '42501' then
        raise;
      end if;
  end;
END $$;

set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-000000000061';
set local "request.jwt.claims" = '{"role":"authenticated"}';

DO $$
DECLARE
  waiter_staff record;
BEGIN
  select *
    into waiter_staff
    from public.agent_cost_summary('00000000-0000-4000-9000-000000000060', 14)
   where agent_type = 'waiter';

  if waiter_staff.runs_7d <> 2 then
    raise exception 'Staff view should match service role aggregation';
  end if;
END $$;

rollback;
