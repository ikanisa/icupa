create table if not exists "group".members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references "group".groups(id) on delete cascade,
  user_id uuid,
  role text not null check (role in ('owner','member')) default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists "group".escrows (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references "group".groups(id) on delete cascade,
  itinerary_id uuid references booking.itineraries(id) on delete set null,
  currency text not null default 'USD',
  target_cents bigint not null check (target_cents > 0),
  min_members int not null default 2,
  deadline timestamptz not null,
  status text not null check (status in ('open','met','expired','cancelled','paid_out')) default 'open',
  created_at timestamptz not null default now()
);

create table if not exists "group".contributions (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references "group".escrows(id) on delete cascade,
  member_id uuid not null references "group".members(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD',
  payment_id uuid,
  created_at timestamptz not null default now()
);

alter table "group".members enable row level security;
alter table "group".escrows enable row level security;
alter table "group".contributions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_members_self_select'
      and schemaname = 'group'
      and tablename = 'members'
  ) then
    create policy p_group_members_self_select on "group".members
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_members_owner_select'
      and schemaname = 'group'
      and tablename = 'members'
  ) then
    create policy p_group_members_owner_select on "group".members
      for select
      using (
        exists (
          select 1
          from "group".members m
          where m.group_id = "group".members.group_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_members_self_insert'
      and schemaname = 'group'
      and tablename = 'members'
  ) then
    create policy p_group_members_self_insert on "group".members
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_escrows_select'
      and schemaname = 'group'
      and tablename = 'escrows'
  ) then
    create policy p_group_escrows_select on "group".escrows
      for select
      using (
        exists (
          select 1
          from "group".members m
          where m.group_id = "group".escrows.group_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_escrows_insert'
      and schemaname = 'group'
      and tablename = 'escrows'
  ) then
    create policy p_group_escrows_insert on "group".escrows
      for insert
      with check (
        exists (
          select 1
          from "group".members m
          where m.group_id = "group".escrows.group_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_contributions_select'
      and schemaname = 'group'
      and tablename = 'contributions'
  ) then
    create policy p_group_contributions_select on "group".contributions
      for select
      using (
        exists (
          select 1
          from "group".members m
          join "group".escrows e on e.group_id = m.group_id
          where m.id = "group".contributions.member_id
            and e.id = "group".contributions.escrow_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_contributions_insert'
      and schemaname = 'group'
      and tablename = 'contributions'
  ) then
    create policy p_group_contributions_insert on "group".contributions
      for insert
      with check (
        exists (
          select 1
          from "group".members m
          join "group".escrows e on e.group_id = m.group_id
          where m.id = "group".contributions.member_id
            and e.id = "group".contributions.escrow_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end
$$;

grant usage on schema "group" to authenticated;
grant select, insert on "group".members to authenticated;
grant select, insert on "group".escrows to authenticated;
grant select, insert on "group".contributions to authenticated;
