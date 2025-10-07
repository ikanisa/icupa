begin;

-- Seed representative telemetry
set local role service_role;

insert into public.offline_sync_events (
    batch_id,
    tenant_id,
    location_id,
    table_session_id,
    replayed_count,
    failed_count,
    latency_ms,
    replay_completed_at
) values
    (
        '00000000-0000-4000-8000-000000000e11',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000011',
        '00000000-0000-4000-8000-000000000601',
        3,
        0,
        850,
        now() - interval '5 minutes'
    ),
    (
        '00000000-0000-4000-8000-000000000e12',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000011',
        '00000000-0000-4000-8000-000000000601',
        2,
        1,
        1600,
        now() - interval '2 minutes'
    ),
    (
        '00000000-0000-4000-8000-000000000e13',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000012',
        '00000000-0000-4000-8000-000000000602',
        4,
        2,
        2100,
        now() - interval '1 minute'
    );

-- Tenant staff can see aggregated telemetry for their venues
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

DO $$
DECLARE
  total_batches bigint;
  failed_batches bigint;
  last_location text;
BEGIN
  select coalesce(sum(total_batches), 0), coalesce(sum(failed_batches), 0)
    into total_batches, failed_batches
    from public.offline_sync_summary('00000000-0000-4000-8000-000000000001', 24);

  if total_batches <> 2 then
    raise exception 'Expected two batches for Kigali tenant summary';
  end if;

  if failed_batches <> 1 then
    raise exception 'Expected one failed batch for Kigali tenant summary';
  end if;

  select location_name
    into last_location
    from public.offline_sync_summary('00000000-0000-4000-8000-000000000002', 24)
   order by last_replay desc nulls last
   limit 1;

  if last_location is distinct from 'Valletta Waterfront' then
    raise exception 'Expected Valletta venue name in summary';
  end if;
END $$;

-- Diners cannot access offline telemetry for other sessions
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000601"}';

DO $$
DECLARE
  sql_state text;
BEGIN
  BEGIN
    perform * from public.offline_sync_summary('00000000-0000-4000-8000-000000000001', 24);
    raise exception 'Expected diner access to be blocked by offline_sync_summary';
  EXCEPTION
    WHEN others THEN
      GET STACKED DIAGNOSTICS sql_state = returned_sqlstate;
      IF sql_state <> '42501' THEN
        RAISE;
      END IF;
  END;
END $$;

-- Service role can request cross-tenant summary by omitting tenant id
perform set_config('request.jwt.claim.role', 'service_role', true);
perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  visible integer;
BEGIN
  select count(*)
    into visible
    from public.offline_sync_summary(null, 24);

  if visible < 2 then
    raise exception 'Expected service role to see summaries across tenants';
  end if;
END $$;

rollback;
