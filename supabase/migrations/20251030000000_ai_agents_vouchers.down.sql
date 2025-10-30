-- Rollback migration for AI Agents Infrastructure
-- This drops the tables and related objects created for the AI voucher agent system
-- Author: AI Agent Implementation
-- Date: 2025-10-30

-- Drop policies
-- DROP POLICY IF EXISTS "Users can read their own vouchers" ON public.vouchers;
-- DROP POLICY IF EXISTS "Users can read their own customer data" ON public.customers;
DROP POLICY IF EXISTS "Service role has full access to vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Service role has full access to customers" ON public.customers;

-- Drop foreign key constraint
ALTER TABLE IF EXISTS public.vouchers DROP CONSTRAINT IF EXISTS fk_vouchers_customer;

-- Drop triggers
DROP TRIGGER IF EXISTS update_vouchers_updated_at ON public.vouchers;
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_vouchers_customer_status;
DROP INDEX IF EXISTS public.idx_vouchers_created_at;
DROP INDEX IF EXISTS public.idx_vouchers_status;
DROP INDEX IF EXISTS public.idx_vouchers_customer_msisdn;
DROP INDEX IF EXISTS public.idx_customers_created_at;
DROP INDEX IF EXISTS public.idx_customers_msisdn;

-- Drop tables
DROP TABLE IF EXISTS public.vouchers;
DROP TABLE IF EXISTS public.customers;

-- Drop function (only if not used elsewhere)
-- DROP FUNCTION IF EXISTS update_updated_at_column();
