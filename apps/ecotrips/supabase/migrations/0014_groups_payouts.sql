create table if not exists "group".payouts (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references "group".escrows(id) on delete cascade,
  total_cents bigint not null,
  currency text not null default 'USD',
  status text check (status in ('pending','processing','succeeded','failed')) default 'pending',
  attempts int default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table "group".escrows
  add column if not exists paid_out_at timestamptz;

create or replace function "group".set_payout_updated_at()
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
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_group_payouts_updated_at'
      and tgrelid = '"group".payouts'::regclass
  ) then
    create trigger trg_group_payouts_updated_at
      before update on "group".payouts
      for each row
      execute function "group".set_payout_updated_at();
  end if;
end
$$;

alter table "group".payouts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_payouts_select'
      and schemaname = 'group'
      and tablename = 'payouts'
  ) then
    create policy p_group_payouts_select on "group".payouts
      for select
      using (
        exists (
          select 1
          from "group".escrows e
          join "group".members m on m.group_id = e.group_id
          where e.id = "group".payouts.escrow_id
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
    where policyname = 'p_group_payouts_insert_ops'
      and schemaname = 'group'
      and tablename = 'payouts'
  ) then
    create policy p_group_payouts_insert_ops on "group".payouts
      for insert
      with check (sec.is_ops(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_payouts_update_ops'
      and schemaname = 'group'
      and tablename = 'payouts'
  ) then
    create policy p_group_payouts_update_ops on "group".payouts
      for update
      using (sec.is_ops(auth.uid()))
      with check (sec.is_ops(auth.uid()));
  end if;
end
$$;
