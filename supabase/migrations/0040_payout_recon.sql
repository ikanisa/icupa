-- External payout reconciliation staging and ops console fixtures.
create table if not exists fin.payouts_ext (
  id uuid primary key default gen_random_uuid(),
  external_ref text not null unique,
  provider text not null default 'stripe',
  amount_cents bigint not null,
  currency text not null default 'USD',
  recorded_at timestamptz not null default timezone('utc', now()),
  reconciled boolean not null default false,
  payout_id uuid references "group".payouts(id),
  internal_ref text,
  internal_amount_cents bigint,
  matched_at timestamptz,
  metadata jsonb,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_fin_payouts_ext_reconciled_recorded_at
  on fin.payouts_ext (reconciled, recorded_at desc);
create index if not exists idx_fin_payouts_ext_recorded_at
  on fin.payouts_ext (recorded_at desc);
create index if not exists idx_fin_payouts_ext_payout_id
  on fin.payouts_ext (payout_id);

create or replace function fin.touch_payouts_ext_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_fin_payouts_ext_updated_at'
      and tgrelid = 'fin.payouts_ext'::regclass
  ) then
    create trigger trg_fin_payouts_ext_updated_at
      before update on fin.payouts_ext
      for each row
      execute function fin.touch_payouts_ext_updated_at();
  end if;
end
$$;

alter table fin.payouts_ext enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'fin'
      and tablename = 'payouts_ext'
      and policyname = 'p_fin_payouts_ext_service_only'
  ) then
    create policy p_fin_payouts_ext_service_only on fin.payouts_ext
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'fin'
      and tablename = 'payouts_ext'
      and policyname = 'p_fin_payouts_ext_select_ops'
  ) then
    create policy p_fin_payouts_ext_select_ops on fin.payouts_ext
      for select
      using (sec.is_ops(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = '"group"'
      and tablename = 'payouts'
      and policyname = 'p_group_payouts_select_ops'
  ) then
    create policy p_group_payouts_select_ops on "group".payouts
      for select
      using (sec.is_ops(auth.uid()));
  end if;
end
$$;

create or replace view ops.v_finance_payouts_ext as
select
  e.id,
  e.external_ref,
  e.provider,
  e.amount_cents,
  e.currency,
  e.recorded_at,
  e.reconciled,
  e.payout_id,
  e.internal_ref,
  e.internal_amount_cents,
  e.matched_at,
  e.metadata,
  e.notes,
  e.created_at,
  e.updated_at
from fin.payouts_ext e;

grant select on ops.v_finance_payouts_ext to authenticated;

do $$
begin
  insert into ops.console_feature_flags as f (key, description, enabled)
  values
    ('OPS_CONSOLE_FINANCE_RECON_FIXTURES', 'Serve finance payout reconciliation fixtures for ops experiments.', false)
  on conflict (key) do update
    set description = excluded.description;
end
$$;

do $$
begin
  insert into ops.console_fixtures as f (key, payload)
  values
    ('finance.payouts.recon.internal', jsonb_build_array(
      jsonb_build_object('payout_id', '11111111-2222-3333-4444-555555555555', 'escrow_id', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'total_cents', 482000, 'currency', 'USD', 'created_at', '2024-05-04T09:12:00Z'),
      jsonb_build_object('payout_id', '66666666-7777-8888-9999-000000000000', 'escrow_id', 'ffffffff-1111-2222-3333-444444444444', 'total_cents', 105000, 'currency', 'USD', 'created_at', '2024-04-24T09:15:00Z'),
      jsonb_build_object('payout_id', 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff', 'escrow_id', '99999999-aaaa-bbbb-cccc-dddddddddddd', 'total_cents', 287500, 'currency', 'USD', 'created_at', '2024-04-08T08:02:00Z')
    )),
    ('finance.payouts.recon.external', jsonb_build_array(
      jsonb_build_object('external_ref', 'po-ext-201', 'amount_cents', 482000, 'currency', 'USD', 'recorded_at', '2024-05-06T10:00:00Z'),
      jsonb_build_object('external_ref', 'po-ext-202', 'amount_cents', 105000, 'currency', 'USD', 'recorded_at', '2024-04-26T11:30:00Z'),
      jsonb_build_object('external_ref', 'po-ext-203', 'amount_cents', 199900, 'currency', 'USD', 'recorded_at', '2024-03-28T07:45:00Z')
    ))
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();
end
$$;
