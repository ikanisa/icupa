-- Phase 9 offline sync telemetry storage

create table if not exists public.offline_sync_events (
    id uuid primary key default uuid_generate_v4(),
    batch_id uuid not null unique,
    tenant_id uuid references public.tenants(id) on delete cascade,
    location_id uuid references public.locations(id) on delete cascade,
    table_session_id uuid references public.table_sessions(id) on delete cascade,
    replayed_count integer not null check (replayed_count >= 0),
    failed_count integer not null check (failed_count >= 0),
    latency_ms integer check (latency_ms is null or latency_ms >= 0),
    queue_started_at timestamptz,
    replay_completed_at timestamptz not null default timezone('utc', now()),
    locale text,
    user_agent text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

comment on table public.offline_sync_events is 'Telemetry emitted after background sync replays queued diner actions.';

create index if not exists offline_sync_events_replay_completed_idx
    on public.offline_sync_events using brin (replay_completed_at);

create index if not exists offline_sync_events_location_idx
    on public.offline_sync_events (location_id, replay_completed_at desc);

create index if not exists offline_sync_events_tenant_idx
    on public.offline_sync_events (tenant_id, replay_completed_at desc);

alter table public.offline_sync_events enable row level security;

create policy if not exists "service role manages offline sync events"
    on public.offline_sync_events
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy if not exists "diners record offline sync telemetry"
    on public.offline_sync_events
    for insert
    with check (
        table_session_id is not null
        and nullif(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-icupa-session', '')::uuid = table_session_id
    );

create policy if not exists "staff read offline sync telemetry"
    on public.offline_sync_events
    for select using (
        auth.role() = 'service_role'
        or (
            coalesce(
                tenant_id,
                (select tenant_id from public.locations where id = offline_sync_events.location_id),
                (
                    select l.tenant_id
                      from public.table_sessions ts
                      join public.tables tb on tb.id = ts.table_id
                      join public.locations l on l.id = tb.location_id
                     where ts.id = offline_sync_events.table_session_id
                     limit 1
                )
            ) is not null
            and is_staff_for_tenant(
                coalesce(
                    tenant_id,
                    (select tenant_id from public.locations where id = offline_sync_events.location_id),
                    (
                        select l.tenant_id
                          from public.table_sessions ts
                          join public.tables tb on tb.id = ts.table_id
                          join public.locations l on l.id = tb.location_id
                         where ts.id = offline_sync_events.table_session_id
                         limit 1
                    )
                ),
                array['owner','manager','admin','support']::role_t[]
            )
        )
    );
