set search_path = public, extensions;

-- Retire legacy SACCO-era auth artifacts
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    execute 'drop table public.users cascade';
  end if;

  if exists (
    select 1 from pg_type
    where typname = 'app_role' and typnamespace = 'public'::regnamespace
  ) then
    execute 'drop type public.app_role cascade';
  end if;
end;
$$;

-- Align auth user bootstrap with shared profile + merchant onboarding expectations
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  avatar_url text;
  locale text;
  prefs jsonb;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.email,
    'Guest'
  );

  avatar_url := nullif(new.raw_user_meta_data->>'avatar_url', '');

  locale := coalesce(nullif(new.raw_user_meta_data->>'locale', ''), 'en');

  prefs := coalesce(new.raw_user_meta_data->'preferences', '{}'::jsonb);

  insert into public.profiles (user_id, display_name, avatar_url, default_locale, preferences)
  values (new.id, display_name, avatar_url, locale, prefs)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        default_locale = case
          when excluded.default_locale is null or excluded.default_locale = '' then public.profiles.default_locale
          else excluded.default_locale
        end,
        preferences = case
          when excluded.preferences is null or excluded.preferences = '{}'::jsonb then public.profiles.preferences
          else excluded.preferences
        end;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Ensures every auth user receives a public profile record and maintains backward-compatible legacy user rows when available.';

-- Merchant profile automation driven off staff role membership
create or replace function public.manage_merchant_profile_from_user_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_roles constant role_t[] := array['owner','manager','cashier','server','chef','kds','auditor','support','admin'];
  has_staff boolean;
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.role = any(staff_roles) then
      insert into public.merchant_profiles (user_id, tenant_id, role)
      values (new.user_id, new.tenant_id, new.role)
      on conflict (user_id) do update
        set tenant_id = excluded.tenant_id,
            role = excluded.role,
            updated_at = now();
    else
      select exists (
        select 1
        from public.user_roles ur
        where ur.user_id = new.user_id
          and ur.role = any(staff_roles)
      ) into has_staff;

      if not has_staff then
        delete from public.merchant_profiles where user_id = new.user_id;
      end if;
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    select exists (
      select 1
      from public.user_roles ur
      where ur.user_id = old.user_id
        and ur.role = any(staff_roles)
    ) into has_staff;

    if not has_staff then
      delete from public.merchant_profiles where user_id = old.user_id;
    end if;

    return old;
  end if;

  return null;
end;
$$;

comment on function public.manage_merchant_profile_from_user_roles() is
  'Creates or removes merchant profile scaffolding whenever staff roles are granted or revoked.';

drop trigger if exists trg_user_roles_manage_merchant_profile on public.user_roles;
create trigger trg_user_roles_manage_merchant_profile
  after insert or update or delete on public.user_roles
  for each row execute function public.manage_merchant_profile_from_user_roles();

-- Backfill profiles for existing auth users missing a profile row
insert into public.profiles (user_id, display_name, avatar_url, default_locale, preferences)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.email,
    'Guest'
  ) as display_name,
  nullif(u.raw_user_meta_data->>'avatar_url', '') as avatar_url,
  coalesce(nullif(u.raw_user_meta_data->>'locale', ''), 'en') as default_locale,
  coalesce(nullif(u.raw_user_meta_data->'preferences', '{}'::jsonb), '{}'::jsonb) as preferences
from auth.users u
where not exists (
  select 1 from public.profiles p where p.user_id = u.id
);

-- Backfill merchant profiles for staff users without an existing record
with ranked_staff as (
  select
    ur.user_id,
    ur.tenant_id,
    ur.role,
    row_number() over (
      partition by ur.user_id
      order by case ur.role
        when 'owner' then 1
        when 'admin' then 2
        when 'manager' then 3
        when 'cashier' then 4
        when 'server' then 5
        when 'chef' then 6
        when 'kds' then 7
        when 'auditor' then 8
        when 'support' then 9
        else 10
      end,
      ur.tenant_id
    ) as rank
  from public.user_roles ur
  where ur.role in ('owner','manager','cashier','server','chef','kds','auditor','support','admin')
)
insert into public.merchant_profiles (user_id, tenant_id, role)
select user_id, tenant_id, role
from ranked_staff
where rank = 1
on conflict (user_id) do update
  set tenant_id = excluded.tenant_id,
      role = excluded.role,
      updated_at = now();
