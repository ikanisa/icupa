-- AI Agents Infrastructure: Vouchers and Customers Tables
-- This migration adds the required tables for the AI voucher agent system
-- Author: AI Agent Implementation
-- Date: 2025-10-30

-- ====================================================================
-- CUSTOMERS TABLE
-- ====================================================================

-- Create customers table for storing customer information
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msisdn TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_msisdn ON public.customers(msisdn);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at DESC);

-- Add comments
COMMENT ON TABLE public.customers IS 'Customer information for AI agent interactions';
COMMENT ON COLUMN public.customers.msisdn IS 'Mobile phone number in international format (e.g., +250788123456)';
COMMENT ON COLUMN public.customers.metadata IS 'Additional customer metadata (JSON)';

-- ====================================================================
-- VOUCHERS TABLE
-- ====================================================================

-- Create vouchers table for storing voucher information
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_msisdn TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'RWF',
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'redeemed', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vouchers_customer_msisdn ON public.vouchers(customer_msisdn);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_at ON public.vouchers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_customer_status ON public.vouchers(customer_msisdn, status);

-- Add comments
COMMENT ON TABLE public.vouchers IS 'Vouchers managed by the AI agent system';
COMMENT ON COLUMN public.vouchers.customer_msisdn IS 'Customer phone number (foreign key to customers.msisdn)';
COMMENT ON COLUMN public.vouchers.amount IS 'Voucher amount in the specified currency';
COMMENT ON COLUMN public.vouchers.status IS 'Voucher status: issued, redeemed, or void';
COMMENT ON COLUMN public.vouchers.metadata IS 'Additional voucher metadata (JSON)';

-- ====================================================================
-- UPDATED_AT TRIGGER
-- ====================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for customers table
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for vouchers table
DROP TRIGGER IF EXISTS update_vouchers_updated_at ON public.vouchers;
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================================================

-- Enable RLS on tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for AI agent functions)
CREATE POLICY "Service role has full access to customers"
  ON public.customers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to vouchers"
  ON public.vouchers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own data
CREATE POLICY "Users can read their own customer data"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can read their own vouchers"
  ON public.vouchers
  FOR SELECT
  TO authenticated
  USING (
    customer_msisdn IN (
      SELECT msisdn FROM public.customers WHERE id::text = auth.uid()::text
    )
  );

-- ====================================================================
-- SAMPLE DATA (for development/testing only)
-- ====================================================================

-- Uncomment the following to insert sample data for testing

/*
-- Sample customers
INSERT INTO public.customers (msisdn, name) VALUES
  ('+250788123456', 'John Doe'),
  ('+250788234567', 'Jane Smith'),
  ('+250788345678', 'Bob Johnson')
ON CONFLICT (msisdn) DO NOTHING;

-- Sample vouchers
INSERT INTO public.vouchers (customer_msisdn, amount, currency, status) VALUES
  ('+250788123456', 5000, 'RWF', 'issued'),
  ('+250788123456', 10000, 'RWF', 'redeemed'),
  ('+250788234567', 7500, 'RWF', 'issued')
ON CONFLICT DO NOTHING;
*/
