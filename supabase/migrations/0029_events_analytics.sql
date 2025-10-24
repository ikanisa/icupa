-- Analytics events warehouse with admin-friendly views.
set search_path = public;

create schema if not exists analytics;

create table if not exists analytics.events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  session_id text,
  actor_id text,
  source text not null default 'client',
  payload jsonb not null,
  request_id text,
  user_agent text,
  referrer text,
  received_ip text,
  captured_at timestamptz not null default now()
);

create index if not exists analytics_events_event_idx
  on analytics.events (event, captured_at desc);

create index if not exists analytics_events_captured_idx
  on analytics.events (captured_at desc);

alter table analytics.events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'analytics'
      and tablename = 'events'
      and policyname = 'analytics_events_ingest'
  ) then
    create policy analytics_events_ingest on analytics.events
      for insert with check (auth.role() = 'service_role');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'analytics'
      and tablename = 'events'
      and policyname = 'analytics_events_read'
  ) then
    create policy analytics_events_read on analytics.events
      for select using (auth.role() = 'service_role' or coalesce(auth.jwt() ->> 'role', '') = 'authenticated');
  end if;
end$$;

create or replace view ops.v_analytics_events as
select
  e.id,
  e.event,
  e.session_id,
  coalesce(e.actor_id, '') as actor_id,
  e.source,
  e.payload,
  e.request_id,
  e.user_agent,
  e.referrer,
  e.received_ip,
  e.captured_at
from analytics.events e;

grant select on ops.v_analytics_events to authenticated;
grant usage on schema analytics to authenticated;

create or replace view ops.v_analytics_event_counts as
select
  event,
  date_trunc('hour', captured_at) as captured_hour,
  count(*) as total,
  count(distinct session_id) as unique_sessions,
  min(captured_at) as first_seen,
  max(captured_at) as last_seen
from analytics.events
group by event, date_trunc('hour', captured_at)
order by captured_hour desc;

grant select on ops.v_analytics_event_counts to authenticated;

do $$
begin
  insert into ops.console_feature_flags as f (key, description, enabled)
  values
    (
      'client.explain_price.glass',
      'Enable ExplainPrice liquid glass card styling in client itinerary view.',
      true
    ),
    (
      'client.autonomy_dial',
      'Expose autonomy dial UX for PlannerCoPilot journeys.',
      true
    ),
    (
      'client.suggestion_chips.top',
      'Render suggestion chips above destination form fields.',
      false
    )
  on conflict (key) do update
    set description = excluded.description;

  insert into ops.console_fixtures as fx (key, payload)
  values
    (
      'client.flags-config',
      jsonb_build_object(
        'features', jsonb_build_object(
          'client.explain_price.glass', true,
          'client.autonomy_dial', true,
          'client.suggestion_chips.top', false
        ),
        'source', 'ops.console_fixtures'
      )
    )
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();
end$$;

insert into analytics.events as e (
  event,
  session_id,
  actor_id,
  source,
  payload,
  request_id,
  user_agent,
  referrer,
  received_ip
)
values
  (
    'search_submitted',
    'sess_offline_fixture',
    null,
    'client',
    jsonb_build_object('destination', 'Kigali', 'adults', 2, 'children', 0),
    'req-fixture-001',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2)',
    'https://app.ecotrips.africa/search',
    '127.0.0.1'
  ),
  (
    'itinerary_viewed',
    'sess_offline_fixture',
    'traveler-fixture',
    'client',
    jsonb_build_object('itinerary_id', 'draft-fixture', 'source', 'offline'),
    'req-fixture-002',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X)',
    'https://app.ecotrips.africa/results',
    '127.0.0.1'
  ),
  (
    'autonomy_dial_changed',
    'sess_admin_fixture',
    'ops-fixture',
    'client',
    jsonb_build_object('level', 'guided'),
    'req-fixture-003',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'https://ops.ecotrips.africa/dashboard',
    '127.0.0.1'
  )
  on conflict (id) do update
    set event = excluded.event;
