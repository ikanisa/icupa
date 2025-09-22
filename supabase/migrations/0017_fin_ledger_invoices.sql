create schema if not exists fin;

create table if not exists fin.ledger (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default timezone('utc', now()),
  payment_id uuid,
  itinerary_id uuid,
  entry_type text not null check (entry_type in (
    'intent_created',
    'capture_succeeded',
    'capture_failed',
    'refund_requested',
    'refund_succeeded',
    'refund_failed'
  )),
  amount_cents bigint not null,
  currency text not null default 'USD',
  provider_ref text,
  note text
);

create index if not exists idx_fin_ledger_payment_id on fin.ledger (payment_id);
create index if not exists idx_fin_ledger_itinerary_id on fin.ledger (itinerary_id);
create index if not exists idx_fin_ledger_entry_type on fin.ledger (entry_type);
create index if not exists idx_fin_ledger_occurred_at on fin.ledger (occurred_at);
create unique index if not exists idx_fin_ledger_natural_key on fin.ledger (
  entry_type,
  coalesce(payment_id::text, '00000000-0000-0000-0000-000000000000'),
  coalesce(provider_ref, '')
);

create table if not exists fin.invoices (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid,
  itinerary_id uuid,
  kind text not null check (kind in ('invoice','credit_note')),
  number text unique,
  total_cents bigint not null,
  currency text not null default 'USD',
  storage_path text,
  created_at timestamptz not null default timezone('utc', now())
);

create sequence if not exists fin.invoice_seq;

drop function if exists fin.next_invoice_number();
create function fin.next_invoice_number()
returns text
language plpgsql
as $$
declare
  seq bigint;
  today text := to_char(timezone('utc', now()), 'YYYYMMDD');
begin
  seq := nextval('fin.invoice_seq');
  return format('INV-%s-%04s', today, seq % 10000);
end;
$$;

grant usage on schema fin to service_role;
grant select, insert, update, delete on all tables in schema fin to service_role;
grant usage, select on all sequences in schema fin to service_role;
