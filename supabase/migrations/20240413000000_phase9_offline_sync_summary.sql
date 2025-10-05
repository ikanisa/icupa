-- Phase 9 offline sync summary helper for admin console visibility

create or replace function public.offline_sync_summary(
    tenant_uuid uuid,
    lookback_hours integer default 24
)
returns table (
    location_id uuid,
    location_name text,
    total_batches bigint,
    failed_batches bigint,
    total_replayed bigint,
    total_failed bigint,
    avg_latency_ms double precision,
    max_latency_ms integer,
    last_replay timestamptz,
    last_failure timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    effective_interval interval;
    caller_role text;
begin
    caller_role := current_setting('request.jwt.claim.role', true);

    if tenant_uuid is null then
        if caller_role is distinct from 'service_role' then
            raise exception 'tenant_uuid is required'
                using errcode = '22004'; -- null value not allowed
        end if;
    elsif caller_role is distinct from 'service_role'
        and not is_staff_for_tenant(tenant_uuid, array['owner','manager','admin','support']::role_t[])
    then
        raise exception 'not authorised to view offline sync summary'
            using errcode = '42501';
    end if;

    effective_interval := make_interval(hours => greatest(1, coalesce(lookback_hours, 24)));

    return query
    with resolved as (
        select
            e.id,
            e.tenant_id,
            e.location_id,
            e.table_session_id,
            e.replayed_count,
            e.failed_count,
            e.latency_ms,
            e.replay_completed_at,
            coalesce(
                e.location_id,
                (
                    select tb.location_id
                      from public.table_sessions ts
                      join public.tables tb on tb.id = ts.table_id
                     where ts.id = e.table_session_id
                     limit 1
                )
            ) as resolved_location_id,
            coalesce(
                e.tenant_id,
                (
                    select l.tenant_id
                      from public.locations l
                     where l.id = e.location_id
                     limit 1
                ),
                (
                    select l.tenant_id
                      from public.table_sessions ts
                      join public.tables tb on tb.id = ts.table_id
                      join public.locations l on l.id = tb.location_id
                     where ts.id = e.table_session_id
                     limit 1
                )
            ) as resolved_tenant_id
        from public.offline_sync_events e
        where e.replay_completed_at >= timezone('utc', now()) - effective_interval
    ),
    filtered as (
        select *
          from resolved
         where tenant_uuid is null
            or resolved_tenant_id = tenant_uuid
    )
    select
        f.resolved_location_id as location_id,
        (
            select loc.name
              from public.locations loc
             where loc.id = f.resolved_location_id
             limit 1
        ) as location_name,
        count(*) as total_batches,
        count(*) filter (where f.failed_count > 0) as failed_batches,
        coalesce(sum(f.replayed_count), 0) as total_replayed,
        coalesce(sum(f.failed_count), 0) as total_failed,
        avg(nullif(f.latency_ms, 0)::double precision) as avg_latency_ms,
        max(f.latency_ms) as max_latency_ms,
        max(f.replay_completed_at) as last_replay,
        max(case when f.failed_count > 0 then f.replay_completed_at end) as last_failure
      from filtered f
     group by f.resolved_location_id
     order by last_replay desc nulls last;
end;
$$;

comment on function public.offline_sync_summary(uuid, integer)
    is 'Returns per-location offline background sync metrics for tenant operators.';
