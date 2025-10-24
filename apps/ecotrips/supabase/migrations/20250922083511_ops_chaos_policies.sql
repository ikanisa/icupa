-- Chaos injection policy registry for synthetic fallbacks.
set search_path = public;

create schema if not exists ops;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'ops' and table_name = 'chaos_policies'
  ) then
    create table ops.chaos_policies (
      key text primary key,
      target text not null,
      mode text not null check (mode in ('force_failure', 'latency_spike', 'degrade_fixture')),
      fallback text,
      enabled boolean not null default false,
      notes text,
      expires_at timestamptz,
      updated_at timestamptz not null default now()
    );
  end if;
end$$;

alter table ops.chaos_policies enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'ops'
      and tablename = 'chaos_policies'
      and policyname = 'chaos_policies_read'
  ) then
    create policy chaos_policies_read on ops.chaos_policies
      for select using (true);
  end if;
end$$;

grant usage on schema ops to authenticated;
grant select on table ops.chaos_policies to authenticated;

comment on table ops.chaos_policies is 'Stores chaos testing overrides used by synthetics and client fallbacks.';
comment on column ops.chaos_policies.mode is 'force_failure=expect upstream outage, latency_spike=artificial delay, degrade_fixture=force fixture responses.';
