set search_path = public;

create schema if not exists config;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'config'
      and table_name = 'router_agents'
  ) then
    create table config.router_agents (
      id uuid primary key default gen_random_uuid(),
      router_id text not null,
      router_version text,
      target_agent text not null,
      allowed_tools text[] not null default '{}'::text[],
      tool_policies jsonb not null default '[]'::jsonb,
      policy_ref text,
      metadata jsonb not null default '{}'::jsonb,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (router_id, target_agent, coalesce(router_version, ''))
    );
  end if;
end$$;

insert into config.router_agents (
  router_id,
  router_version,
  target_agent,
  allowed_tools,
  tool_policies,
  policy_ref,
  metadata,
  active
)
values
  (
    'RouterAgent',
    'v1',
    'PlannerCoPilot',
    '{quote.search,inventory.hold,checkout.intent,permits.request}',
    '[
      {"key": "checkout.intent", "autonomy_floor": 4, "require_license": true, "policy_id": "router.v1.checkout"},
      {"key": "permits.request", "require_license": true, "policy_id": "router.v1.permits"},
      {"key": "inventory.hold", "autonomy_floor": 3, "policy_id": "router.v1.hold"}
    ]'::jsonb,
    'router.v1.planner',
    '{"domain": "planner", "service_tools": ["quote.search", "inventory.hold"]}'::jsonb,
    true
  ),
  (
    'RouterAgent',
    'v1',
    'ConciergeGuide',
    '{notify.whatsapp_send,map.route,map.nearby}',
    '[
      {"key": "map.route", "policy_id": "router.v1.route"},
      {"key": "map.nearby", "policy_id": "router.v1.nearby"}
    ]'::jsonb,
    'router.v1.concierge',
    '{"domain": "concierge", "service_tools": ["map.route", "map.nearby"]}'::jsonb,
    true
  ),
  (
    'RouterAgent',
    'v1',
    'SupportCopilot',
    '{ops.bookings,ops.exceptions,ops.refund,notify.whatsapp}',
    '[
      {"key": "ops.refund", "autonomy_floor": 4, "policy_id": "router.v1.refund"},
      {"key": "notify.whatsapp", "policy_id": "router.v1.notify"}
    ]'::jsonb,
    'router.v1.support',
    '{"domain": "support", "service_tools": ["ops.bookings", "ops.exceptions"]}'::jsonb,
    true
  ),
  (
    'RouterAgent',
    'v1',
    'SupplierOpsAgent',
    '{ops.bookings,ops.exceptions,ops.refund,webhook.stripe}',
    '[
      {"key": "ops.refund", "autonomy_floor": 4, "policy_id": "router.v1.ops.refund"},
      {"key": "webhook.stripe", "autonomy_floor": 3, "policy_id": "router.v1.ops.stripe"}
    ]'::jsonb,
    'router.v1.ops',
    '{"domain": "ops"}'::jsonb,
    true
  )
on conflict (router_id, target_agent, coalesce(router_version, '')) do nothing;

create or replace function config.touch_router_agents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'config_router_agents_updated_at'
  ) then
    drop trigger config_router_agents_updated_at on config.router_agents;
  end if;
end$$;

create trigger config_router_agents_updated_at
  before update on config.router_agents
  for each row
  execute function config.touch_router_agents_updated_at();

grant usage on schema config to service_role;
grant select on config.router_agents to service_role;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'config'
      and tablename = 'router_agents'
      and indexname = 'router_agents_router_idx'
  ) then
    create index router_agents_router_idx
      on config.router_agents (router_id, coalesce(router_version, ''));
  end if;
end$$;
