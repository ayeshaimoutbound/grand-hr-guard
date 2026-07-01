
-- ============ EXPENSES enhancements ============
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS invoice_ref text,
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_date date;

-- Reset expense categories to the requested set
DELETE FROM public.expense_categories;
INSERT INTO public.expense_categories (name) VALUES
  ('Transport'),
  ('Uniforms'),
  ('Stationaries'),
  ('Other');

-- ============ INVENTORY ITEMS ============
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,           -- 'Shirt (Men)','Trouser (Men)','Blouse (Women)','Skirt (Women)','Shoes','Epaulet','Lanyard','Stationary','Umbrella','Other'
  item_name text NOT NULL,
  size text,
  color text,
  gender text,
  epaulet_rank text,                 -- 'OIC'|'SSO'|'JSO/LSO'
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric(10,2),
  supplier text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory read all auth" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory insert auth" ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inventory update auth" ON public.inventory_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory delete admin" ON public.inventory_items
  FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER inventory_items_updated
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INVENTORY MOVEMENTS ============
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  change integer NOT NULL,               -- +in / -out
  reason text,                            -- 'bulk_upload','manual_add','issue','adjustment'
  reference text,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invmove read auth" ON public.inventory_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invmove insert auth" ON public.inventory_movements
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invmove delete admin" ON public.inventory_movements
  FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- ============ USER MODULE ACCESS ============
CREATE TABLE IF NOT EXISTS public.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_access TO authenticated;
GRANT ALL ON public.user_module_access TO service_role;
ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uma read own" ON public.user_module_access
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "uma manage superadmin" ON public.user_module_access
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER uma_updated
  BEFORE UPDATE ON public.user_module_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
