set search_path = public;

-- Merchant onboarding profile linked to auth user + tenant
create table if not exists public.merchant_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role role_t not null default 'owner',
  whatsapp_number_e164 text,
  whatsapp_verified_at timestamptz,
  momo_code text,
  location_gps jsonb,
  onboarding_step text not null default 'start',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchant_profiles_tenant_idx on public.merchant_profiles(tenant_id);

create or replace function public.touch_merchant_profiles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_merchant_profiles on public.merchant_profiles;
create trigger trg_touch_merchant_profiles
  before update on public.merchant_profiles
  for each row
  execute function public.touch_merchant_profiles();

alter table public.merchant_profiles enable row level security;

create policy if not exists "merchant self-read" on public.merchant_profiles
  for select using (auth.uid() = user_id);

create policy if not exists "merchant self-update" on public.merchant_profiles
  for update using (auth.uid() = user_id);

create policy if not exists "service role manage" on public.merchant_profiles
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- WhatsApp OTP storage (hashed)
create table if not exists public.whatsapp_otps (
  id uuid primary key default uuid_generate_v4(),
  phone_e164 text not null,
  otp_hash text not null,
  purpose text not null default 'login',
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_otps_phone_idx on public.whatsapp_otps(phone_e164);
create index if not exists whatsapp_otps_expires_idx on public.whatsapp_otps(expires_at);

alter table public.whatsapp_otps enable row level security;

create policy if not exists "service role only" on public.whatsapp_otps
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Customer preferences for diners
create table if not exists public.customer_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text,
  allergens text[] not null default '{}',
  dislikes text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.customer_prefs enable row level security;

create policy if not exists "customer self" on public.customer_prefs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
