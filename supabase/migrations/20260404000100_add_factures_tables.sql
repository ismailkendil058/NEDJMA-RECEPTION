-- Add factures (invoices) feature for Manager
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('check', 'caisse', 'ccp', 'manager payment')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  expiration_date DATE,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Policies for managers
CREATE POLICY "Managers can handle suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can handle products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can handle invoices" ON public.invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can handle invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));

-- Indexes
CREATE INDEX idx_invoices_supplier ON public.invoices(supplier_id);
CREATE INDEX idx_invoices_date ON public.invoices(date);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON public.invoice_items(product_id);
