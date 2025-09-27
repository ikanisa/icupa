-- Phase 9 notifications and push subscription support
-- Creates storage for web push subscriptions and supporting helpers

create table if not exists public.notification_subscriptions (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    location_id uuid references public.locations(id) on delete cascade,
    table_session_id uuid references public.table_sessions(id) on delete cascade,
    profile_id uuid references auth.users(id) on delete cascade,
    endpoint text not null,
    p256dh text not null,
    auth text not null,
    subscription jsonb not null,
    user_agent text,
    locale text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    last_seen_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists notification_subscriptions_endpoint_key
    on public.notification_subscriptions(endpoint);

create index if not exists notification_subscriptions_table_session_id_idx
    on public.notification_subscriptions(table_session_id);

create index if not exists notification_subscriptions_tenant_id_idx
    on public.notification_subscriptions(tenant_id);

alter table public.notification_subscriptions enable row level security;

create policy if not exists "service role manages notification subscriptions"
    on public.notification_subscriptions
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy if not exists "diners manage their table subscriptions"
    on public.notification_subscriptions
    for select using (
        table_session_id is not null
        and nullif(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-icupa-session', '')::uuid = table_session_id
    );

create policy if not exists "diners insert their table subscriptions"
    on public.notification_subscriptions
    for insert with check (
        table_session_id is not null
        and nullif(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-icupa-session', '')::uuid = table_session_id
    );

create policy if not exists "diners delete their table subscriptions"
    on public.notification_subscriptions
    for delete using (
        table_session_id is not null
        and nullif(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-icupa-session', '')::uuid = table_session_id
    );

create or replace function public.touch_notification_subscription()
returns trigger language plpgsql as
$$
begin
    new.updated_at = timezone('utc', now());
    if new.last_seen_at is null then
        new.last_seen_at = timezone('utc', now());
    end if;
    return new;
end;
$$;

create trigger notification_subscriptions_set_updated
    before update on public.notification_subscriptions
    for each row execute function public.touch_notification_subscription();
