set search_path = public, extensions;

drop trigger if exists notification_subscriptions_set_updated on public.notification_subscriptions;
drop function if exists public.touch_notification_subscription();
drop policy if exists "diners delete their table subscriptions" on public.notification_subscriptions;
drop policy if exists "diners insert their table subscriptions" on public.notification_subscriptions;
drop policy if exists "diners manage their table subscriptions" on public.notification_subscriptions;
drop policy if exists "service role manages notification subscriptions" on public.notification_subscriptions;
drop table if exists public.notification_subscriptions cascade;
