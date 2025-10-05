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

do $$
declare
  group_count integer;
  mod_count integer;
begin
  select count(*) into group_count from public.modifier_groups where item_id = '00000000-0000-4000-8000-000000000401';
  if group_count <> 1 then
    raise exception 'Diner should see 1 modifier group for Chill Brew, saw %', group_count;
  end if;

  select count(*) into mod_count from public.order_item_mods;
  if mod_count <> 1 then
    raise exception 'Diner should see exactly 1 existing order item modifier, saw %', mod_count;
  end if;
end $$;

do $$
declare
  inserted_id uuid;
begin
  insert into public.order_item_mods (id, order_item_id, modifier_id, price_delta_cents)
  values (uuid_generate_v4(), '00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000f12', 700)
  returning id into inserted_id;

  if inserted_id is null then
    raise exception 'Expected diner-controlled insert of order item modifier to succeed';
  end if;
end $$;

-- Expire the active session and confirm access is revoked immediately
set local role service_role;
update public.table_sessions
   set expires_at = now() - interval '1 minute'
 where id = '00000000-0000-4000-8000-000000000601';
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
  if visible_count <> 0 then
    raise exception 'Expired session must not expose orders, saw %', visible_count;
  end if;
end $$;

do $$
declare
  sql_state text;
begin
  begin
    insert into public.order_item_mods (id, order_item_id, modifier_id, price_delta_cents)
    values (uuid_generate_v4(), '00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000f12', 700);
    raise exception 'Expected RLS failure when inserting after session expiry';
  exception
    when others then
      get stacked diagnostics sql_state = returned_sqlstate;
      if sql_state <> '42501' then
        raise;
      end if;
  end;
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

do $$
declare
  mod_count integer;
  sql_state text;
begin
  select count(*) into mod_count from public.order_item_mods;
  if mod_count <> 0 then
    raise exception 'Diner should not see modifiers for another session, saw %', mod_count;
  end if;

  begin
    insert into public.order_item_mods (id, order_item_id, modifier_id, price_delta_cents)
    values (uuid_generate_v4(), '00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000f12', 700);
    raise exception 'Expected RLS failure when inserting modifier for foreign order';
  exception
    when others then
      get stacked diagnostics sql_state = returned_sqlstate;
      if sql_state <> '42501' then
        raise;
      end if;
  end;
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

do $$
declare
  mod_count integer;
begin
  select count(*) into mod_count from public.order_item_mods;
  if mod_count <> 1 then
    raise exception 'Staff should see all order item modifiers, saw %', mod_count;
  end if;
end $$;

rollback;
