
-- Batch numbering sequence
CREATE SEQUENCE IF NOT EXISTS public.uniform_batch_seq;

-- Uniform batches
CREATE TABLE public.uniform_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  invoice_number TEXT,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_batches TO authenticated;
GRANT ALL ON public.uniform_batches TO service_role;
ALTER TABLE public.uniform_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uniform_batches read" ON public.uniform_batches FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "uniform_batches insert" ON public.uniform_batches FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "uniform_batches update" ON public.uniform_batches FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "uniform_batches delete" ON public.uniform_batches FOR DELETE TO authenticated
  USING (private.is_admin_or_super(auth.uid()));
CREATE TRIGGER uniform_batches_updated BEFORE UPDATE ON public.uniform_batches
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();

-- Batch number generator: UB-YYYYMM-####
CREATE OR REPLACE FUNCTION public.next_uniform_batch_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('public.uniform_batch_seq');
  RETURN 'UB-' || to_char(now(),'YYYYMM') || '-' || lpad(n::text, 4, '0');
END $$;

-- Extend inventory_movements
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.uniform_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC;

-- Extend uniform_advances for 3-month installment tracking
ALTER TABLE public.uniform_advances
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.uniform_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installment_months INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS installment_index INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC;

-- Food vendors
CREATE TABLE public.food_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  contact TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_vendors TO authenticated;
GRANT ALL ON public.food_vendors TO service_role;
ALTER TABLE public.food_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_vendors read" ON public.food_vendors FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_vendors write" ON public.food_vendors FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_vendors update" ON public.food_vendors FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()))
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_vendors delete" ON public.food_vendors FOR DELETE TO authenticated
  USING (private.is_admin_or_super(auth.uid()));
CREATE TRIGGER food_vendors_updated BEFORE UPDATE ON public.food_vendors
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();

-- Food rates
CREATE TABLE public.food_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  location TEXT,
  breakfast_rate NUMERIC NOT NULL DEFAULT 0,
  lunch_rate NUMERIC NOT NULL DEFAULT 0,
  dinner_rate NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_rates TO authenticated;
GRANT ALL ON public.food_rates TO service_role;
ALTER TABLE public.food_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_rates read" ON public.food_rates FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_rates write" ON public.food_rates FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_rates update" ON public.food_rates FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()))
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_rates delete" ON public.food_rates FOR DELETE TO authenticated
  USING (private.is_admin_or_super(auth.uid()));
CREATE TRIGGER food_rates_updated BEFORE UPDATE ON public.food_rates
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();

-- Food charges (detailed per-employee per-month)
CREATE TABLE public.food_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  location TEXT,
  month DATE NOT NULL,
  breakfast_count INT NOT NULL DEFAULT 0,
  lunch_count INT NOT NULL DEFAULT 0,
  dinner_count INT NOT NULL DEFAULT 0,
  breakfast_rate NUMERIC NOT NULL DEFAULT 0,
  lunch_rate NUMERIC NOT NULL DEFAULT 0,
  dinner_rate NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  vendor_id UUID REFERENCES public.food_vendors(id) ON DELETE SET NULL,
  manual_entry BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, company_id, location, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_charges TO authenticated;
GRANT ALL ON public.food_charges TO service_role;
ALTER TABLE public.food_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_charges read" ON public.food_charges FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_charges write" ON public.food_charges FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_charges update" ON public.food_charges FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()))
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "food_charges delete" ON public.food_charges FOR DELETE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE TRIGGER food_charges_updated BEFORE UPDATE ON public.food_charges
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
