begin;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

DO $$
DECLARE
  event_id uuid;
  suggestion_id uuid;
  campaign_id uuid;
  has_vacant boolean;
  spend integer;
  increment_events integer;
  capped_detail jsonb;
BEGIN
  select exists (select 1 from public.tables where state = 'vacant') into has_vacant;
  if not has_vacant then
    raise exception 'Expected at least one table with default state "vacant"';
  end if;

  update public.tables
     set state = 'ordering'
   where id = '00000000-0000-4000-8000-000000000501';
  if not found then
    raise exception 'Expected demo table to update state';
  end if;

  insert into public.table_state_events (table_id, previous_state, next_state, notes)
  values ('00000000-0000-4000-8000-000000000501', 'vacant', 'ordering', 'Test automation')
  returning id into event_id;
  if event_id is null then
    raise exception 'Expected table state event id';
  end if;

  insert into public.menu_copy_suggestions (item_id, locale, tone, suggested_name, suggested_description, rationale)
  values (
    '00000000-0000-4000-8000-000000000401',
    'en-RW',
    'friendly',
    'AI Brew',
    'An aromatic brew prepared with care.',
    'Regression test seed'
  )
  returning id into suggestion_id;
  if suggestion_id is null then
    raise exception 'Expected suggestion id';
  end if;

  update public.menu_copy_suggestions
     set status = 'approved'
   where id = suggestion_id;

  update public.inventory_items
     set auto_86 = true,
         auto_86_level = 'L2',
         reorder_threshold = 5
   where id in (select id from public.inventory_items limit 1);

  insert into public.promo_campaigns (tenant_id, location_id, name, description, epsilon, budget_cap_cents, frequency_cap)
  values (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000011',
    'Dessert Delight',
    'Late night dessert booster',
    0.05,
    50000,
    2
  )
  returning id into campaign_id;
  if campaign_id is null then
    raise exception 'Expected campaign id';
  end if;

  insert into public.promo_audit_events (campaign_id, action, detail)
  values (campaign_id, 'created', jsonb_build_object('actor', 'regression-test'));

  perform public.increment_promo_spend(campaign_id, 1500);
  select spent_cents into spend from public.promo_campaigns where id = campaign_id;
  if spend <> 1500 then
    raise exception 'Expected promo spend to increase to 1500 cents but found %', spend;
  end if;

  perform public.increment_promo_spend(campaign_id, 60000);
  select spent_cents into spend from public.promo_campaigns where id = campaign_id;
  if spend <> 50000 then
    raise exception 'Promo spend should clamp to budget cap (50000) but found %', spend;
  end if;

  select count(*)
    into increment_events
    from public.promo_audit_events pae
   where pae.campaign_id = campaign_id and pae.action = 'spend:increment';

  select detail
    into capped_detail
    from public.promo_audit_events pae
   where pae.campaign_id = campaign_id and pae.action = 'spend:increment'
   order by pae.created_at desc
   limit 1;

  if increment_events <> 2 then
    raise exception 'Expected two spend increment audit events but found %', increment_events;
  end if;

  if coalesce(capped_detail->>'was_capped', 'false') <> 'true' then
    raise exception 'Expected last spend increment audit event to record cap enforcement';
  end if;

  -- Outstanding payments helper should surface at least one authorised payment for the demo tenant
  perform 1
    from public.merchant_outstanding_payments(null)
   where payment_id = '00000000-0000-4000-8000-000000000901'
   limit 1;
  if not found then
    raise exception 'Expected outstanding payments helper to return authorised seed payment';
  end if;

  insert into public.payment_action_events (payment_id, order_id, action, notes)
  values (
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000701',
    'manual_capture',
    'Regression test log'
  );
END $$;

rollback;
