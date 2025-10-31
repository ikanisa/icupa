-- Migration: MCP Roles, RLS Policies, and Audit Log
-- Description: Set up Model Context Protocol (MCP) infrastructure for AI agents
-- Created: 2025-10-29

-- ============================================================================
-- 1. CREATE AGENT ROLES
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'waiter_agent') then
    create role waiter_agent;
  end if;
  
  if not exists (select 1 from pg_roles where rolname = 'cfo_agent') then
    create role cfo_agent;
  end if;
  
  if not exists (select 1 from pg_roles where rolname = 'legal_agent') then
    create role legal_agent;
  end if;
end
$$;

-- Grant usage on schema to all agent roles
grant usage on schema public to waiter_agent, cfo_agent, legal_agent;

-- ============================================================================
-- 2. CREATE CORE TABLES (IF NOT EXISTS)
-- ============================================================================

-- Waiter Agent Tables
create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  name text not null,
  description text,
  active boolean not null default true,
  position int not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  table_id text,
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments_pending (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  amount numeric(10,2) not null,
  status text not null default 'pending',
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CFO Agent Tables
create table if not exists public.gl_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  account_dr text not null,
  account_cr text not null,
  amount numeric(15,2) not null,
  memo text,
  posted_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  amount numeric(15,2) not null,
  due_date date not null,
  currency text not null default 'USD',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  region text,
  rate numeric(5,4) not null,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now()
);

create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  from_currency text not null,
  to_currency text not null,
  rate numeric(15,6) not null,
  effective_date date not null,
  created_at timestamptz not null default now()
);

-- Legal Agent Tables
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.filings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id),
  title text not null,
  body text,
  status text not null default 'draft',
  filed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doc_store (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id),
  filename text not null,
  content_type text,
  storage_path text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id),
  due_at timestamptz not null,
  note text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. GRANT MINIMAL PRIVILEGES PER AGENT
-- ============================================================================

-- Waiter Agent: Read menus, manage orders and payments
grant select, insert, update on public.menus to waiter_agent;
grant select, insert, update on public.orders to waiter_agent;
grant select, insert, update on public.payments_pending to waiter_agent;

-- CFO Agent: Manage financial records
grant select, insert, update on public.gl_entries to cfo_agent;
grant select, insert, update on public.invoices to cfo_agent;
grant select on public.tax_rules to cfo_agent;
grant select on public.fx_rates to cfo_agent;

-- Legal Agent: Manage cases and documents
grant select, insert, update on public.cases to legal_agent;
grant select, insert, update on public.filings to legal_agent;
grant select, insert on public.doc_store to legal_agent;
grant select, insert, update on public.deadlines to legal_agent;

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

alter table public.menus enable row level security;
alter table public.orders enable row level security;
alter table public.payments_pending enable row level security;
alter table public.gl_entries enable row level security;
alter table public.invoices enable row level security;
alter table public.cases enable row level security;
alter table public.filings enable row level security;
alter table public.doc_store enable row level security;
alter table public.deadlines enable row level security;

-- ============================================================================
-- 5. CREATE RLS POLICIES
-- ============================================================================

-- Waiter Agent: Scope to venue via session variable
drop policy if exists waiter_menus_scope on public.menus;
create policy waiter_menus_scope on public.menus
  for all
  using (
    current_role = 'waiter_agent' 
    and venue_id = coalesce(
      nullif(current_setting('app.venue_id', true), '')::uuid, 
      venue_id
    )
  );

drop policy if exists waiter_orders_scope on public.orders;
create policy waiter_orders_scope on public.orders
  for all
  using (
    current_role = 'waiter_agent' 
    and venue_id = coalesce(
      nullif(current_setting('app.venue_id', true), '')::uuid, 
      venue_id
    )
  )
  with check (
    current_role = 'waiter_agent' 
    and venue_id = coalesce(
      nullif(current_setting('app.venue_id', true), '')::uuid, 
      venue_id
    )
  );

drop policy if exists waiter_payments_scope on public.payments_pending;
create policy waiter_payments_scope on public.payments_pending
  for all
  using (
    current_role = 'waiter_agent'
    and exists (
      select 1 from public.orders o 
      where o.id = payments_pending.order_id 
      and o.venue_id = coalesce(
        nullif(current_setting('app.venue_id', true), '')::uuid, 
        o.venue_id
      )
    )
  );

-- CFO Agent: Unrestricted read/write (but audited)
drop policy if exists cfo_gl_rw on public.gl_entries;
create policy cfo_gl_rw on public.gl_entries
  for all 
  using (current_role = 'cfo_agent') 
  with check (current_role = 'cfo_agent');

drop policy if exists cfo_invoices_rw on public.invoices;
create policy cfo_invoices_rw on public.invoices
  for all 
  using (current_role = 'cfo_agent') 
  with check (current_role = 'cfo_agent');

-- Legal Agent: Assigned cases only
drop policy if exists legal_cases_read on public.cases;
create policy legal_cases_read on public.cases
  for select 
  using (
    current_role = 'legal_agent' 
    and (assigned_to = auth.uid() or assigned_to is null)
  );

drop policy if exists legal_cases_write on public.cases;
create policy legal_cases_write on public.cases
  for insert 
  with check (
    current_role = 'legal_agent' 
    and assigned_to = auth.uid()
  );

drop policy if exists legal_cases_update on public.cases;
create policy legal_cases_update on public.cases
  for update 
  using (
    current_role = 'legal_agent' 
    and assigned_to = auth.uid()
  );

drop policy if exists legal_filings_rw on public.filings;
create policy legal_filings_rw on public.filings
  for all
  using (
    current_role = 'legal_agent'
    and exists (
      select 1 from public.cases c 
      where c.id = filings.case_id 
      and c.assigned_to = auth.uid()
    )
  );

drop policy if exists legal_docs_read on public.doc_store;
create policy legal_docs_read on public.doc_store
  for select 
  using (
    current_role = 'legal_agent'
    and exists (
      select 1 from public.cases c 
      where c.id = doc_store.case_id 
      and c.assigned_to = auth.uid()
    )
  );

drop policy if exists legal_docs_insert on public.doc_store;
create policy legal_docs_insert on public.doc_store
  for insert
  with check (
    current_role = 'legal_agent'
    and exists (
      select 1 from public.cases c 
      where c.id = doc_store.case_id 
      and c.assigned_to = auth.uid()
    )
  );

drop policy if exists legal_deadlines_rw on public.deadlines;
create policy legal_deadlines_rw on public.deadlines
  for all
  using (
    current_role = 'legal_agent'
    and exists (
      select 1 from public.cases c 
      where c.id = deadlines.case_id 
      and c.assigned_to = auth.uid()
    )
  );

-- ============================================================================
-- 6. CREATE MCP AUDIT LOG
-- ============================================================================

create table if not exists public.mcp_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  role text not null,
  tool text not null,
  operation text not null,
  resource text not null,
  params jsonb,
  ok boolean not null default true,
  error text
);

-- Grant insert to all agent roles for audit logging
grant insert on public.mcp_audit_log to waiter_agent, cfo_agent, legal_agent;

-- Create index for common queries
create index if not exists idx_mcp_audit_log_at on public.mcp_audit_log(at desc);
create index if not exists idx_mcp_audit_log_role on public.mcp_audit_log(role);
create index if not exists idx_mcp_audit_log_ok on public.mcp_audit_log(ok) where ok = false;

-- ============================================================================
-- 7. CREATE PENDING JOURNALS TABLE FOR HUMAN-IN-THE-LOOP (CFO)
-- ============================================================================

create table if not exists public.pending_journals (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  account_dr text not null,
  account_cr text not null,
  amount numeric(15,2) not null,
  memo text,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Grant insert to CFO agent for approval requests
grant insert, select on public.pending_journals to cfo_agent;

-- Enable RLS
alter table public.pending_journals enable row level security;

-- CFO can insert pending journals
drop policy if exists cfo_pending_journals_insert on public.pending_journals;
create policy cfo_pending_journals_insert on public.pending_journals
  for insert
  with check (current_role = 'cfo_agent');

-- CFO can read their own pending journals
drop policy if exists cfo_pending_journals_read on public.pending_journals;
create policy cfo_pending_journals_read on public.pending_journals
  for select
  using (current_role = 'cfo_agent');
