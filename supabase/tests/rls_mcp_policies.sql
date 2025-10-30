-- MCP RLS Policy Tests
-- Description: Test Row Level Security policies for MCP agent roles
-- Tests should pass with pg_tap assertions

begin;

-- Load the pgTAP extension
select plan(15);

-- ============================================================================
-- SETUP: Create test data
-- ============================================================================

-- Create test venue
insert into public.menus (id, venue_id, name, active) 
values ('00000000-0000-0000-0000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Test Menu', true);

-- Create test order
insert into public.orders (id, venue_id, table_id, total) 
values ('00000000-0000-0000-0000-000000000002'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'A1', 100.00);

-- Create test GL entry
insert into public.gl_entries (id, entry_date, account_dr, account_cr, amount) 
values ('00000000-0000-0000-0000-000000000003'::uuid, '2025-01-01', '1000', '2000', 500.00);

-- Create test case
insert into public.cases (id, title, assigned_to) 
values ('00000000-0000-0000-0000-000000000004'::uuid, 'Test Case', null);

-- ============================================================================
-- TEST: Agent Roles Exist
-- ============================================================================

select has_role('waiter_agent', 'waiter_agent role should exist');
select has_role('cfo_agent', 'cfo_agent role should exist');
select has_role('legal_agent', 'legal_agent role should exist');

-- ============================================================================
-- TEST: Table Grants
-- ============================================================================

-- Waiter Agent
select has_table_privilege('waiter_agent', 'public.menus', 'SELECT', 'waiter_agent can SELECT from menus');
select has_table_privilege('waiter_agent', 'public.orders', 'INSERT', 'waiter_agent can INSERT into orders');

-- CFO Agent
select has_table_privilege('cfo_agent', 'public.gl_entries', 'SELECT', 'cfo_agent can SELECT from gl_entries');
select has_table_privilege('cfo_agent', 'public.invoices', 'INSERT', 'cfo_agent can INSERT into invoices');

-- Legal Agent
select has_table_privilege('legal_agent', 'public.cases', 'SELECT', 'legal_agent can SELECT from cases');
select has_table_privilege('legal_agent', 'public.filings', 'INSERT', 'legal_agent can INSERT into filings');

-- ============================================================================
-- TEST: Negative Grants - Agents Cannot Access Other Tables
-- ============================================================================

-- Waiter cannot access CFO tables
select is(
  has_table_privilege('waiter_agent', 'public.gl_entries', 'SELECT'),
  false,
  'waiter_agent cannot SELECT from gl_entries'
);

-- CFO cannot access Legal tables (unless they have grants)
select is(
  has_table_privilege('cfo_agent', 'public.cases', 'SELECT'),
  false,
  'cfo_agent cannot SELECT from cases'
);

-- Legal cannot access Waiter tables
select is(
  has_table_privilege('legal_agent', 'public.orders', 'SELECT'),
  false,
  'legal_agent cannot SELECT from orders'
);

-- ============================================================================
-- TEST: RLS Policies Exist
-- ============================================================================

select policies_are('public', 'menus', array['waiter_menus_scope'], 'menus has correct RLS policies');
select policies_are('public', 'orders', array['waiter_orders_scope'], 'orders has correct RLS policies');
select policies_are('public', 'gl_entries', array['cfo_gl_rw'], 'gl_entries has correct RLS policies');

-- ============================================================================
-- CLEANUP
-- ============================================================================

select * from finish();

rollback;
