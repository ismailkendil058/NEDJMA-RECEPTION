-- Add expenses table for Manager
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Managers can do everything with expenses" 
ON public.expenses 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Indexes
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_expenses_created_by ON public.expenses(created_by);
