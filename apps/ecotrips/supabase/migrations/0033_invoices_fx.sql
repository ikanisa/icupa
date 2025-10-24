set search_path = fin, public;

create table if not exists fin.invoice_fx (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references fin.invoices(id) on delete cascade,
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18,8) not null check (rate > 0),
  provider text not null default 'manual',
  captured_at timestamptz not null default timezone('utc', now()),
  metadata jsonb default '{}'::jsonb,
  request_key text,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_invoice_fx_invoice_currency on fin.invoice_fx(invoice_id, quote_currency);
create unique index if not exists idx_invoice_fx_request on fin.invoice_fx(request_key) where request_key is not null;
