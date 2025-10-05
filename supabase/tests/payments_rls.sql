begin;

-- Kigali diner bound to table session 601 should see only their payment row
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000601"}';

-- Diner should only see their own pending/captured payments
DO $$
DECLARE
  visible_count integer;
  foreign_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.payments;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'Diner should see exactly 1 payment row, saw %', visible_count;
  END IF;

  SELECT count(*) INTO foreign_count
  FROM public.payments
  WHERE order_id <> '00000000-0000-4000-8000-000000000701';
  IF foreign_count <> 0 THEN
    RAISE EXCEPTION 'Diner must not see payments for other orders, saw %', foreign_count;
  END IF;
END $$;

-- Attempting to update payment status should be blocked by RLS
DO $$
DECLARE
  sql_state text;
BEGIN
  BEGIN
    UPDATE public.payments
       SET status = 'captured'
     WHERE id = '00000000-0000-4000-8000-000000000901';
    RAISE EXCEPTION 'Expected diner update on payments to be rejected by RLS';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS sql_state = returned_sqlstate;
      IF sql_state <> '42501' THEN
        RAISE;
      END IF;
  END;
END $$;

-- Expire the session and confirm visibility is revoked immediately
set local role service_role;
UPDATE public.table_sessions
   SET expires_at = now() - interval '1 minute'
 WHERE id = '00000000-0000-4000-8000-000000000601';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000601"}';

DO $$
DECLARE
  visible_after_expiry integer;
BEGIN
  SELECT count(*) INTO visible_after_expiry FROM public.payments;
  IF visible_after_expiry <> 0 THEN
    RAISE EXCEPTION 'Expired session should not expose payments, saw %', visible_after_expiry;
  END IF;
END $$;

-- Another session header should not leak the expired payment row
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000602"}';

DO $$
DECLARE
  other_session_count integer;
BEGIN
  SELECT count(*) INTO other_session_count FROM public.payments;
  IF other_session_count <> 0 THEN
    RAISE EXCEPTION 'Foreign session must not see Kigali payments, saw %', other_session_count;
  END IF;
END $$;

-- Tenant manager should see both tenant payment records
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.headers" = '{}';

DO $$
DECLARE
  tenant_payment_count integer;
BEGIN
  SELECT count(*) INTO tenant_payment_count FROM public.payments;
  IF tenant_payment_count <> 2 THEN
    RAISE EXCEPTION 'Staff manager should see payments across tenants, saw %', tenant_payment_count;
  END IF;
END $$;

rollback;
