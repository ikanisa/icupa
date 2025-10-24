-- concierge traveler presence and live slot aggregates
set check_function_bodies = off;

create schema if not exists concierge;

create table if not exists concierge.presence (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references "group".groups(id) on delete cascade,
  itinerary_id uuid references booking.itineraries(id) on delete set null,
  status text not null default 'offline' check (status in ('online','away','offline')),
  is_opted_in boolean not null default true,
  visible boolean not null default true,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (traveler_id, group_id)
);

create table if not exists "group".live_slots (
  escrow_id uuid primary key references "group".escrows(id) on delete cascade,
  group_id uuid not null references "group".groups(id) on delete cascade,
  itinerary_id uuid references booking.itineraries(id) on delete set null,
  total_slots int not null default 0 check (total_slots >= 0),
  filled_slots int not null default 0 check (filled_slots >= 0),
  available_slots int not null default 0 check (available_slots >= 0),
  waitlist_slots int not null default 0 check (waitlist_slots >= 0),
  presence_opt_in int not null default 0 check (presence_opt_in >= 0),
  presence_visible int not null default 0 check (presence_visible >= 0),
  presence_online int not null default 0 check (presence_online >= 0),
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function concierge.set_presence_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create or replace function "group".set_live_slots_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_concierge_presence_updated_at'
      and tgrelid = 'concierge.presence'::regclass
  ) then
    create trigger trg_concierge_presence_updated_at
      before update on concierge.presence
      for each row execute function concierge.set_presence_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_group_live_slots_updated_at'
      and tgrelid = '"group".live_slots'::regclass
  ) then
    create trigger trg_group_live_slots_updated_at
      before update on "group".live_slots
      for each row execute function "group".set_live_slots_updated_at();
  end if;
end;
$$;

alter table concierge.presence enable row level security;
alter table "group".live_slots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'concierge' and tablename = 'presence' and policyname = 'p_concierge_presence_self_access'
  ) then
    create policy p_concierge_presence_self_access on concierge.presence
      for all
      using (auth.uid() = traveler_id)
      with check (auth.uid() = traveler_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'concierge' and tablename = 'presence' and policyname = 'p_concierge_presence_group_view'
  ) then
    create policy p_concierge_presence_group_view on concierge.presence
      for select
      using (
        visible
        and exists (
          select 1 from "group".members m
          where m.group_id = concierge.presence.group_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'concierge' and tablename = 'presence' and policyname = 'p_concierge_presence_group_insert'
  ) then
    create policy p_concierge_presence_group_insert on concierge.presence
      for insert
      with check (
        auth.uid() = traveler_id
        and exists (
          select 1 from "group".members m
          where m.group_id = concierge.presence.group_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'concierge' and tablename = 'presence' and policyname = 'p_concierge_presence_group_update'
  ) then
    create policy p_concierge_presence_group_update on concierge.presence
      for update
      using (auth.uid() = traveler_id)
      with check (
        auth.uid() = traveler_id
        and exists (
          select 1 from "group".members m
          where m.group_id = concierge.presence.group_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'group' and tablename = 'live_slots' and policyname = 'p_group_live_slots_member_view'
  ) then
    create policy p_group_live_slots_member_view on "group".live_slots
      for select
      using (
        visible
        or exists (
          select 1 from "group".members m
          where m.group_id = "group".live_slots.group_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'group' and tablename = 'live_slots' and policyname = 'p_group_live_slots_member_update'
  ) then
    create policy p_group_live_slots_member_update on "group".live_slots
      for update
      using (
        exists (
          select 1 from "group".members m
          where m.group_id = "group".live_slots.group_id
            and m.user_id = auth.uid()
        )
      )
      with check (
        visible in (true, false)
      );
  end if;
end;
$$;

grant usage on schema concierge to authenticated;
grant select, insert, update, delete on concierge.presence to authenticated;

grant select on "group".live_slots to authenticated;
grant update on "group".live_slots to authenticated;
alter table "group".live_slots
  add column if not exists presence_online int not null default 0 check (presence_online >= 0);
alter policy p_group_live_slots_member_update on "group".live_slots
  with check (
    exists (
      select 1
      from "group".live_slots original
      where original.escrow_id = "group".live_slots.escrow_id
        and original.total_slots = "group".live_slots.total_slots
        and original.filled_slots = "group".live_slots.filled_slots
        and original.available_slots = "group".live_slots.available_slots
        and original.waitlist_slots = "group".live_slots.waitlist_slots
        and original.presence_opt_in = "group".live_slots.presence_opt_in
        and original.presence_visible = "group".live_slots.presence_visible
        and original.presence_online = "group".live_slots.presence_online
    )
  );

create or replace function "group".enforce_live_slots_visibility_only()
returns trigger as $$
declare
  request_role text := current_setting('request.jwt.claim.role', true);
begin
  if coalesce(request_role, 'service_role') in ('service_role', 'supabase_admin') then
    return new;
  end if;

  if
    new.group_id is distinct from old.group_id or
    new.itinerary_id is distinct from old.itinerary_id or
    new.total_slots is distinct from old.total_slots or
    new.filled_slots is distinct from old.filled_slots or
    new.available_slots is distinct from old.available_slots or
    new.waitlist_slots is distinct from old.waitlist_slots or
    new.presence_opt_in is distinct from old.presence_opt_in or
    new.presence_visible is distinct from old.presence_visible or
    new.presence_online is distinct from old.presence_online
  then
    raise exception 'Only live slot visibility may be updated by group members.';
  end if;

  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_group_live_slots_visibility_only'
      and tgrelid = '"group".live_slots'::regclass
  ) then
    create trigger trg_group_live_slots_visibility_only
      before update on "group".live_slots
      for each row execute function "group".enforce_live_slots_visibility_only();
  end if;
end;
$$;
