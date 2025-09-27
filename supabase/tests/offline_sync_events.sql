begin;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000601"}';

insert into public.offline_sync_events (
    batch_id,
    table_session_id,
    location_id,
    replayed_count,
    failed_count,
    latency_ms,
    queue_started_at,
    replay_completed_at,
    locale
) values (
    '00000000-0000-4000-8000-000000000e01',
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000011',
    3,
    1,
    1450,
    now() - interval '2 minutes',
    now(),
    'en-RW'
);

-- Attempting to reuse the same session header for a different table session should fail RLS
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000602"}';

DO $$
DECLARE
  sql_state text;
BEGIN
  BEGIN
    insert into public.offline_sync_events (
        batch_id,
        table_session_id,
        location_id,
        replayed_count,
        failed_count
    ) values (
        '00000000-0000-4000-8000-000000000e02',
        '00000000-0000-4000-8000-000000000601',
        '00000000-0000-4000-8000-000000000011',
        1,
        0
    );
    RAISE EXCEPTION 'Expected insert with mismatched session header to be blocked by RLS';
  EXCEPTION
    WHEN others THEN
      GET STACKED DIAGNOSTICS sql_state = returned_sqlstate;
      IF sql_state <> '42501' THEN
        RAISE;
      END IF;
  END;
END $$;

-- Staff should be able to inspect telemetry for their tenant
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';
set local "request.headers" = '{}';

DO $$
DECLARE
  visible integer;
BEGIN
  SELECT count(*)
    INTO visible
    FROM public.offline_sync_events;
  IF visible <= 0 THEN
    RAISE EXCEPTION 'Expected staff to see at least one offline sync telemetry row';
  END IF;
END $$;

rollback;
