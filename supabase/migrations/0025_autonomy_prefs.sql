set search_path = public;

create schema if not exists app;

create table if not exists app.user_autonomy_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  autonomy_level text not null check (autonomy_level in ('L0','L1','L2','L3','L4','L5')),
  composer_mode text not null default 'assist' check (composer_mode in ('observe','assist','co_create','delegate')),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create index if not exists user_autonomy_prefs_category_idx
  on app.user_autonomy_prefs (category);

alter table app.user_autonomy_prefs enable row level security;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'app_user_autonomy_prefs_updated_at'
  ) then
    drop trigger app_user_autonomy_prefs_updated_at on app.user_autonomy_prefs;
  end if;
end$$;

create or replace function app.touch_user_autonomy_prefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_user_autonomy_prefs_updated_at
  before update on app.user_autonomy_prefs
  for each row
  execute function app.touch_user_autonomy_prefs_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'user_autonomy_prefs'
      and policyname = 'app_user_autonomy_prefs_select'
  ) then
    create policy app_user_autonomy_prefs_select
      on app.user_autonomy_prefs
      for select
      using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'user_autonomy_prefs'
      and policyname = 'app_user_autonomy_prefs_insert'
  ) then
    create policy app_user_autonomy_prefs_insert
      on app.user_autonomy_prefs
      for insert
      with check (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'user_autonomy_prefs'
      and policyname = 'app_user_autonomy_prefs_update'
  ) then
    create policy app_user_autonomy_prefs_update
      on app.user_autonomy_prefs
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

grant usage on schema app to authenticated;
grant select, insert, update on app.user_autonomy_prefs to authenticated;
