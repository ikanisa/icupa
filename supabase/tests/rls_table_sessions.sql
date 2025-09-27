begin;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000601"}';

-- Diner can only see their active table session
DO $$
DECLARE
  session_count integer;
BEGIN
  SELECT count(*) INTO session_count FROM public.table_sessions;
  IF session_count <> 1 THEN
    RAISE EXCEPTION 'Diner should see exactly one table session, saw %', session_count;
  END IF;
END $$;

-- Diner cannot view another session directly even when filtering by id
DO $$
DECLARE
  foreign_count integer;
BEGIN
  SELECT count(*) INTO foreign_count
  FROM public.table_sessions
  WHERE id = '00000000-0000-4000-8000-000000000602';
  IF foreign_count <> 0 THEN
    RAISE EXCEPTION 'Diner should not see foreign table session rows, saw %', foreign_count;
  END IF;
END $$;

-- Direct inserts are blocked by RLS; only service role may create sessions
DO $$
DECLARE
  sql_state text;
BEGIN
  BEGIN
    INSERT INTO public.table_sessions (id, table_id, issued_for_ip, device_fingerprint, expires_at)
    VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000501', '10.0.0.1', 'fake-device', now() + interval '4 hours');
    RAISE EXCEPTION 'Expected insert into table_sessions to be blocked by RLS';
  EXCEPTION
    WHEN others THEN
      GET STACKED DIAGNOSTICS sql_state = returned_sqlstate;
      IF sql_state <> '42501' THEN
        RAISE;
      END IF;
  END;
END $$;

-- Expire the original session and confirm it no longer resolves via the helper
set local role service_role;
update public.table_sessions
   set expires_at = now() - interval '1 minute'
 where id = '00000000-0000-4000-8000-000000000601';
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000601"}';

DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*) INTO remaining FROM public.table_sessions;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'Expired sessions must not be visible, saw % rows', remaining;
  END IF;
END $$;

-- Switch to a second diner session; they should only see their own record
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000602"}';

DO $$
DECLARE
  own_count integer;
  other_count integer;
BEGIN
  SELECT count(*) INTO own_count
  FROM public.table_sessions
  WHERE id = '00000000-0000-4000-8000-000000000602';
  IF own_count <> 1 THEN
    RAISE EXCEPTION 'Second diner should see their session row, saw %', own_count;
  END IF;

  SELECT count(*) INTO other_count
  FROM public.table_sessions
  WHERE id = '00000000-0000-4000-8000-000000000601';
  IF other_count <> 0 THEN
    RAISE EXCEPTION 'Second diner should not see the first session row, saw %', other_count;
  END IF;
END $$;

-- Removing the header should result in zero visible rows
set local "request.headers" = '{}';

DO $$
DECLARE
  empty_count integer;
BEGIN
  SELECT count(*) INTO empty_count FROM public.table_sessions;
  IF empty_count <> 0 THEN
    RAISE EXCEPTION 'Requests without x-icupa-session header must not see table sessions, saw %', empty_count;
  END IF;
END $$;

rollback;
