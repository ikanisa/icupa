-- Create database schema without problematic vector index
-- Create missing enums
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_t') THEN
        CREATE TYPE order_status_t AS ENUM ('draft', 'submitted', 'in_kitchen', 'ready', 'served', 'settled', 'voided');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_t') THEN
        CREATE TYPE payment_method_t AS ENUM ('card', 'sepa', 'momo', 'airtel');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_t') THEN
        CREATE TYPE payment_status_t AS ENUM ('pending', 'captured', 'failed', 'cancelled');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_state_t') THEN
        CREATE TYPE table_state_t AS ENUM ('vacant', 'ordering', 'in_kitchen', 'served', 'bill', 'cleaning');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'autonomy_level_t') THEN
        CREATE TYPE autonomy_level_t AS ENUM ('L0', 'L1', 'L2', 'L3');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_status_t') THEN
        CREATE TYPE compliance_status_t AS ENUM ('pending', 'in_progress', 'resolved', 'overdue');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_severity_t') THEN
        CREATE TYPE compliance_severity_t AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
END$$;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_roles table first
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  role role_t NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

-- Create core tables
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  region region_t NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.locations (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  region region_t NOT NULL,
  currency CHAR(3) NOT NULL,
  timezone TEXT NOT NULL,
  vat_rate DECIMAL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menus (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  menu_id UUID NOT NULL REFERENCES public.menus(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.items (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  menu_id UUID REFERENCES public.menus(id),
  category_id UUID REFERENCES public.categories(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_alcohol BOOLEAN NOT NULL DEFAULT false,
  allergens TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tables (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id),
  code TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 2,
  state table_state_t NOT NULL DEFAULT 'vacant',
  layout JSONB NOT NULL DEFAULT jsonb_build_object('x', 0, 'y', 0, 'width', 160, 'height', 160),
  qrtoken TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.table_sessions (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.tables(id),
  issued_for_ip INET,
  device_fingerprint TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  table_id UUID REFERENCES public.tables(id),
  table_session_id UUID REFERENCES public.table_sessions(id),
  customer_id UUID,
  status order_status_t NOT NULL DEFAULT 'draft',
  channel TEXT NOT NULL DEFAULT 'dine_in',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  service_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  method payment_method_t NOT NULL,
  status payment_status_t NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL,
  provider_ref TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  region region_t NOT NULL,
  fiscal_id TEXT,
  url TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  sku TEXT NOT NULL,
  display_name TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 0,
  par_level DECIMAL NOT NULL DEFAULT 0,
  reorder_threshold DECIMAL NOT NULL DEFAULT 0,
  lead_time_days INTEGER DEFAULT 2,
  track BOOLEAN NOT NULL DEFAULT true,
  auto_86 BOOLEAN NOT NULL DEFAULT false,
  auto_86_level TEXT NOT NULL DEFAULT 'L0',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.table_state_events (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.tables(id),
  previous_state table_state_t,
  next_state table_state_t NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_runtime_configs (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  agent_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  session_budget_usd DECIMAL NOT NULL DEFAULT 0.75,
  daily_budget_usd DECIMAL NOT NULL DEFAULT 50,
  instructions TEXT NOT NULL DEFAULT 'Follow tenant brand guardrails and cite sources.',
  tool_allowlist TEXT[] NOT NULL DEFAULT '{}',
  autonomy_level autonomy_level_t NOT NULL DEFAULT 'L0',
  retrieval_ttl_minutes INTEGER NOT NULL DEFAULT 5,
  experiment_flag TEXT,
  sync_pending BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.agent_config_audit_events (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.agent_runtime_configs(id),
  tenant_id UUID REFERENCES public.tenants(id),
  agent_type TEXT NOT NULL,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB NOT NULL,
  changed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_tasks (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status compliance_status_t NOT NULL DEFAULT 'pending',
  severity compliance_severity_t NOT NULL DEFAULT 'medium',
  region region_t NOT NULL,
  due_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runtime_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_config_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_tasks ENABLE ROW LEVEL SECURITY;

-- Create helper functions
CREATE OR REPLACE FUNCTION public.current_table_session_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT nullif(current_setting('request.headers', true)::jsonb->>'x-icupa-session','')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_for_tenant(target_tenant uuid, allowed_roles role_t[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT exists (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = target_tenant
      AND ur.role = any(allowed_roles)
  );
$$;

-- Create basic RLS policies
DROP POLICY IF EXISTS "Items readable public" ON public.items;
CREATE POLICY "Items readable public" ON public.items FOR SELECT USING (is_available);

DROP POLICY IF EXISTS "Categories readable public" ON public.categories;
CREATE POLICY "Categories readable public" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Menus readable public" ON public.menus;
CREATE POLICY "Menus readable public" ON public.menus FOR SELECT USING (true);

DROP POLICY IF EXISTS "Locations readable public" ON public.locations;
CREATE POLICY "Locations readable public" ON public.locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Table sessions access by header" ON public.table_sessions;
CREATE POLICY "Table sessions access by header" ON public.table_sessions FOR SELECT 
USING (id = current_table_session_id());

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_location ON public.orders(location_id);
CREATE INDEX IF NOT EXISTS idx_items_location ON public.items(location_id);
CREATE INDEX IF NOT EXISTS idx_tables_location ON public.tables(location_id);