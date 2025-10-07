-- Phase 9 offline sync telemetry storage

create table if not exists public.offline_sync_events (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    location_id uuid references public.locations(id) on delete cascade,
    table_session_id uuid not null references public.table_sessions(id) on delete cascade,
    replayed_count integer not null,
    first_enqueued_at timestamptz,
    replay_started_at timestamptz,
    replay_completed_at timestamptz,
    queued_duration_ms integer,
    replay_latency_ms integer,
    had_error boolean not null default false,
    metadata jsonb,
    batch_id text,
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists offline_sync_events_table_session_batch_idx
    on public.offline_sync_events(table_session_id, batch_id);

create index if not exists offline_sync_events_tenant_created_idx
    on public.offline_sync_events(tenant_id, created_at desc);

create index if not exists offline_sync_events_location_created_idx
    on public.offline_sync_events(location_id, created_at desc);

alter table public.offline_sync_events enable row level security;

create policy if not exists "service role manages offline sync events"
    on public.offline_sync_events
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy if not exists "diners log offline sync events"
    on public.offline_sync_events
    for insert with check (
        nullif(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-icupa-session', '')::uuid = table_session_id
    );

create policy if not exists "diners read their offline sync events"
    on public.offline_sync_events
    for select using (
        nullif(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-icupa-session', '')::uuid = table_session_id
    );

create policy if not exists "merchant staff read offline sync events"
    on public.offline_sync_events
    for select using (
        exists (
            select 1
            from public.merchant_profiles mp
            where mp.user_id = auth.uid()
              and mp.tenant_id = public.offline_sync_events.tenant_id
        )
    );

create or replace function public.populate_offline_sync_event()
returns trigger
language plpgsql
as $$
declare
    resolved_location uuid;
    resolved_tenant uuid;
begin
    if new.location_id is null then
        select tbl.location_id
        into resolved_location
        from public.table_sessions ts
        join public.tables tbl on tbl.id = ts.table_id
        where ts.id = new.table_session_id
        limit 1;

        if resolved_location is not null then
            new.location_id := resolved_location;
        end if;
    end if;

    if new.tenant_id is null and new.location_id is not null then
        select tenant_id into resolved_tenant from public.locations where id = new.location_id limit 1;
        if resolved_tenant is not null then
            new.tenant_id := resolved_tenant;
        end if;
    end if;

    new.replay_started_at := coalesce(new.replay_started_at, timezone('utc', now()));
    new.replay_completed_at := coalesce(new.replay_completed_at, timezone('utc', now()));
    new.created_at := coalesce(new.created_at, timezone('utc', now()));
    new.batch_id := coalesce(nullif(new.batch_id, ''), uuid_generate_v4()::text);

    return new;
end;
$$;

create trigger offline_sync_events_enrich
    before insert on public.offline_sync_events
    for each row execute function public.populate_offline_sync_event();
