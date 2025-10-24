begin;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

DO $$
DECLARE
  rw_orders integer;
  eu_orders integer;
  tenant_mismatches integer;
  payment_currency_mismatches integer;
  qr_missing integer;
  promo_mismatches integer;
BEGIN
  select count(*) into rw_orders from public.orders where tenant_id = '00000000-0000-4000-8000-000000000001';
  select count(*) into eu_orders from public.orders where tenant_id = '00000000-0000-4000-8000-000000000002';

  IF rw_orders = 0 OR eu_orders = 0 THEN
    RAISE EXCEPTION 'Expected seeded orders for both tenants (found % for RW, % for EU)', rw_orders, eu_orders;
  END IF;

  select count(*)
    into tenant_mismatches
    from public.orders o
    join public.locations l on l.id = o.location_id
   where o.tenant_id <> l.tenant_id;

  IF tenant_mismatches > 0 THEN
    RAISE EXCEPTION 'Orders must reference locations that belong to the same tenant (found % mismatches)', tenant_mismatches;
  END IF;

  select count(*)
    into payment_currency_mismatches
    from public.payments p
    join public.orders o on o.id = p.order_id
    join public.locations l on l.id = o.location_id
   where (l.currency = 'RWF' and p.currency <> 'RWF')
      or (l.currency = 'EUR' and p.currency <> 'EUR');

  IF payment_currency_mismatches > 0 THEN
    RAISE EXCEPTION 'Payments currency must align with the location currency (found % mismatches)', payment_currency_mismatches;
  END IF;

  select count(*)
    into qr_missing
    from public.tables t
    where t.qrtoken IS NULL;

  IF qr_missing > 0 THEN
    RAISE EXCEPTION 'Each table must have a QR payload to support admin re-issue tooling (missing % entries)', qr_missing;
  END IF;

  select count(*)
    into promo_mismatches
    from public.promo_campaigns pc
    join public.locations l on l.id = pc.location_id
   where pc.tenant_id <> l.tenant_id;

  IF promo_mismatches > 0 THEN
    RAISE EXCEPTION 'Promo campaigns should scope to a single tenant/location (found % mismatches)', promo_mismatches;
  END IF;
END $$;

rollback;
