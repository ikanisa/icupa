set search_path = public, extensions;

drop trigger if exists trg_touch_merchant_profiles on public.merchant_profiles;
drop function if exists public.touch_merchant_profiles();
drop policy if exists "service role manage" on public.merchant_profiles;
drop policy if exists "merchant self-update" on public.merchant_profiles;
drop policy if exists "merchant self-read" on public.merchant_profiles;
drop table if exists public.merchant_profiles cascade;

drop policy if exists "service role only" on public.whatsapp_otps;
drop table if exists public.whatsapp_otps cascade;

drop policy if exists "customer self" on public.customer_prefs;
drop table if exists public.customer_prefs cascade;
