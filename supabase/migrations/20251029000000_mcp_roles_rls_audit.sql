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

alter table public.pending_journals
  add column if not exists approver_notes text;

-- Grant insert to CFO agent for approval requests
grant insert, select, update on public.pending_journals to cfo_agent;

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

drop policy if exists cfo_pending_journals_update on public.pending_journals;
create policy cfo_pending_journals_update on public.pending_journals
  for update
  using (current_role = 'cfo_agent')
  with check (current_role = 'cfo_agent');

-- ============================================================================
-- 8. MCP EXECUTION HELPERS
-- ============================================================================

create or replace function public.mcp_apply_rls_context(p_rls jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ctx record;
begin
  if p_rls is null or p_rls = '{}'::jsonb then
    return;
  end if;

  for ctx in select key, value from jsonb_each_text(p_rls) loop
    if ctx.key !~ '^[a-zA-Z0-9_.]+$' then
      raise exception 'Invalid RLS context key: %', ctx.key;
    end if;
    perform set_config(ctx.key, ctx.value, true);
  end loop;
end;
$$;

revoke all on function public.mcp_apply_rls_context(jsonb) from public;
grant execute on function public.mcp_apply_rls_context(jsonb) to service_role;

create or replace function public.mcp_execute_sql(
  p_role text,
  p_sql text,
  p_params jsonb default '[]'::jsonb,
  p_rls_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  allowed_roles constant text[] := array['waiter_agent', 'cfo_agent', 'legal_agent'];
  normalized_sql text;
  statement_keyword text;
  substituted_sql text := p_sql;
  param_count integer;
  idx integer;
  param_value jsonb;
  replacement text;
  result jsonb;
begin
  if p_role is null or p_role not in (select unnest(allowed_roles)) then
    raise exception 'Role % is not permitted to execute MCP SQL', p_role using errcode = '42501';
  end if;

  if p_sql is null or length(trim(p_sql)) = 0 then
    raise exception 'SQL statement is required for MCP execution';
  end if;

  if position(';' in p_sql) > 0 then
    raise exception 'Multiple statements are not allowed in MCP SQL';
  end if;

  normalized_sql := lower(trim(p_sql));
  statement_keyword := split_part(normalized_sql, ' ', 1);

  if statement_keyword not in ('select', 'insert', 'update', 'delete', 'with') then
    raise exception 'Unsupported SQL statement: %', statement_keyword;
  end if;

  if p_params is not null and jsonb_typeof(p_params) <> 'array' then
    raise exception 'Params must be a JSON array';
  end if;

  perform public.mcp_apply_rls_context(p_rls_context);

  execute format('set local role %I', p_role);

  param_count := coalesce(jsonb_array_length(p_params), 0);

  for idx in reverse 1..param_count loop
    param_value := p_params->(idx - 1);

    if param_value is null or param_value = 'null'::jsonb then
      replacement := 'NULL';
    else
      case jsonb_typeof(param_value)
        when 'number', 'boolean' then
          replacement := param_value::text;
        when 'string' then
          replacement := quote_nullable(trim(both '"' from param_value::text));
        else
          replacement := quote_nullable(param_value::text);
      end case;
    end if;

    substituted_sql := regexp_replace(substituted_sql, '\\$' || idx, replacement, 'g');
  end loop;

  execute format(
    'select coalesce(jsonb_agg(row_to_json(q)), ''[]''::jsonb) from (%s) as q',
    substituted_sql
  )
  into result;

  return result;
end;
$$;

revoke all on function public.mcp_execute_sql(text, text, jsonb, jsonb) from public;
grant execute on function public.mcp_execute_sql(text, text, jsonb, jsonb) to service_role;

create or replace function public.mcp_handle_pending_journal(
  action text,
  pending_journal_id uuid,
  approver uuid,
  notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  journal_record public.pending_journals%rowtype;
  gl_entry_id uuid;
  response jsonb;
begin
  if action not in ('approve', 'reject') then
    raise exception 'Invalid action. Expected approve or reject';
  end if;

  execute 'set local role cfo_agent';

  select *
    into journal_record
  from public.pending_journals
  where id = pending_journal_id
  for update;

  if not found then
    raise exception 'Pending journal not found';
  end if;

  if journal_record.status <> 'pending' then
    raise exception format('Journal already %s', journal_record.status);
  end if;

  if action = 'approve' then
    insert into public.gl_entries (
      entry_date,
      account_dr,
      account_cr,
      amount,
      memo,
      posted_by
    )
    values (
      journal_record.entry_date,
      journal_record.account_dr,
      journal_record.account_cr,
      journal_record.amount,
      journal_record.memo,
      approver
    )
    returning id into gl_entry_id;

    update public.pending_journals
      set status = 'approved',
          approved_by = approver,
          approved_at = now(),
          approver_notes = coalesce(notes, approver_notes)
      where id = journal_record.id;

    response := jsonb_build_object(
      'pending_journal_id', journal_record.id,
      'status', 'approved',
      'gl_entry_id', gl_entry_id
    );
  else
    update public.pending_journals
      set status = 'rejected',
          approved_by = approver,
          approved_at = now(),
          approver_notes = coalesce(notes, approver_notes)
      where id = journal_record.id;

    response := jsonb_build_object(
      'pending_journal_id', journal_record.id,
      'status', 'rejected'
    );
  end if;

  return response;
end;
$$;

revoke all on function public.mcp_handle_pending_journal(text, uuid, uuid, text) from public;
grant execute on function public.mcp_handle_pending_journal(text, uuid, uuid, text) to service_role;
