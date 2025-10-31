-- Revert Migration: MCP Roles, RLS Policies, and Audit Log
-- Description: Rollback MCP infrastructure for AI agents
-- Created: 2025-10-29

-- ============================================================================
-- 1. DROP RLS POLICIES
-- ============================================================================

-- Waiter Agent Policies
drop policy if exists waiter_menus_scope on public.menus;
drop policy if exists waiter_orders_scope on public.orders;
drop policy if exists waiter_payments_scope on public.payments_pending;

-- CFO Agent Policies
drop policy if exists cfo_gl_rw on public.gl_entries;
drop policy if exists cfo_invoices_rw on public.invoices;
drop policy if exists cfo_pending_journals_insert on public.pending_journals;
drop policy if exists cfo_pending_journals_read on public.pending_journals;

-- Legal Agent Policies
drop policy if exists legal_cases_read on public.cases;
drop policy if exists legal_cases_write on public.cases;
drop policy if exists legal_cases_update on public.cases;
drop policy if exists legal_filings_rw on public.filings;
drop policy if exists legal_docs_read on public.doc_store;
drop policy if exists legal_docs_insert on public.doc_store;
drop policy if exists legal_deadlines_rw on public.deadlines;

-- ============================================================================
-- 2. DISABLE ROW LEVEL SECURITY (OPTIONAL - ONLY IF TABLES WERE CREATED BY THIS MIGRATION)
-- ============================================================================

-- Note: Only disable RLS if these tables were created by this migration
-- If tables existed before, leave RLS as-is

-- alter table public.menus disable row level security;
-- alter table public.orders disable row level security;
-- alter table public.payments_pending disable row level security;
-- alter table public.gl_entries disable row level security;
-- alter table public.invoices disable row level security;
-- alter table public.cases disable row level security;
-- alter table public.filings disable row level security;
-- alter table public.doc_store disable row level security;
-- alter table public.deadlines disable row level security;
-- alter table public.pending_journals disable row level security;

-- ============================================================================
-- 3. REVOKE PRIVILEGES
-- ============================================================================

-- Revoke from Waiter Agent
revoke select, insert, update on public.menus from waiter_agent;
revoke select, insert, update on public.orders from waiter_agent;
revoke select, insert, update on public.payments_pending from waiter_agent;

-- Revoke from CFO Agent
revoke select, insert, update on public.gl_entries from cfo_agent;
revoke select, insert, update on public.invoices from cfo_agent;
revoke select on public.tax_rules from cfo_agent;
revoke select on public.fx_rates from cfo_agent;
revoke insert, select on public.pending_journals from cfo_agent;

-- Revoke from Legal Agent
revoke select, insert, update on public.cases from legal_agent;
revoke select, insert, update on public.filings from legal_agent;
revoke select, insert on public.doc_store from legal_agent;
revoke select, insert, update on public.deadlines from legal_agent;

-- Revoke audit log access
revoke insert on public.mcp_audit_log from waiter_agent, cfo_agent, legal_agent;

-- Drop execution function
drop function if exists public.mcp_execute_tool(text, text, jsonb, jsonb);

-- Revoke schema usage
revoke usage on schema public from waiter_agent, cfo_agent, legal_agent;

-- ============================================================================
-- 4. DROP TABLES (ONLY IF CREATED BY THIS MIGRATION)
-- ============================================================================

-- Note: Only drop tables if they were created by this migration
-- If tables existed before, leave them intact

-- drop table if exists public.pending_journals;
-- drop table if exists public.mcp_audit_log;
-- drop table if exists public.deadlines;
-- drop table if exists public.doc_store;
-- drop table if exists public.filings;
-- drop table if exists public.cases;
-- drop table if exists public.fx_rates;
-- drop table if exists public.tax_rules;
-- drop table if exists public.invoices;
-- drop table if exists public.gl_entries;
-- drop table if exists public.payments_pending;
-- drop table if exists public.orders;
-- drop table if exists public.menus;

-- ============================================================================
-- 5. DROP AGENT ROLES
-- ============================================================================

-- Note: Be cautious when dropping roles - ensure no other objects depend on them
drop role if exists waiter_agent;
drop role if exists cfo_agent;
drop role if exists legal_agent;
