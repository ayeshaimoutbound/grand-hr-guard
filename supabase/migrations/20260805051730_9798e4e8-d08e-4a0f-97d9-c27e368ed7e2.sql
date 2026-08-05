-- VENDORS
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL,
  vendor_type text NOT NULL DEFAULT 'Other',
  contact_person text,
  phone text,
  email text,
  address text,
  bank_account_name text,
  bank_account_number text,
  bank_name text,
  branch_name text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_select" ON public.vendors FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "vendors_delete" ON public.vendors FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE TRIGGER vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();

-- MAINTENANCE
CREATE TABLE public.maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  maintenance_type text NOT NULL DEFAULT 'Repair',
  asset_name text,
  vehicle_number text,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  next_service_date date,
  cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Completed',
  is_paid boolean NOT NULL DEFAULT false,
  payment_method text,
  cheque_number text,
  cheque_date date,
  invoice_ref text,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_records TO authenticated;
GRANT ALL ON public.maintenance_records TO service_role;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maint_select" ON public.maintenance_records FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "maint_insert" ON public.maintenance_records FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "maint_update" ON public.maintenance_records FOR UPDATE TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "maint_delete" ON public.maintenance_records FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE TRIGGER maint_updated BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();

-- INVENTORY PURCHASES
CREATE TABLE public.inventory_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.uniform_batches(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  payment_method text,
  cheque_number text,
  cheque_date date,
  invoice_ref text,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_purchases TO authenticated;
GRANT ALL ON public.inventory_purchases TO service_role;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invpur_select" ON public.inventory_purchases FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "invpur_insert" ON public.inventory_purchases FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "invpur_update" ON public.inventory_purchases FOR UPDATE TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "invpur_delete" ON public.inventory_purchases FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE TRIGGER invpur_updated BEFORE UPDATE ON public.inventory_purchases FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();

-- INVENTORY CLASSIFICATION
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS inventory_type text NOT NULL DEFAULT 'non_critical',
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS auto_threshold boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

UPDATE public.inventory_items
SET inventory_type = 'critical'
WHERE category IN ('Shirt (Men)','Trouser (Men)','Blouse (Women)','Skirt (Women)','Shoes','Epaulet','Lanyard');