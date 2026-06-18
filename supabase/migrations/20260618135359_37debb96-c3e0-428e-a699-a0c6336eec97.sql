
-- ============== APP SETTINGS (daily minimum wage etc.) ==============
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable by authenticated" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings managed by admin" ON public.app_settings
  FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
INSERT INTO public.app_settings(key,value) VALUES ('daily_min_wage','1200') ON CONFLICT DO NOTHING;

-- ============== EMPLOYEES: per-employee OT settings ==============
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS ot_hourly_rate numeric NOT NULL DEFAULT 225,
  ADD COLUMN IF NOT EXISTS normal_ot_hours numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS extended_ot_hours numeric NOT NULL DEFAULT 6;

-- ============== COMPANIES: client OT rate (Rs/hour) ==============
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS client_ot_rate numeric NOT NULL DEFAULT 0;

-- ============== OVERTIME ENTRIES ==============
CREATE TABLE public.overtime_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  hours integer NOT NULL,
  ot_rate numeric NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_entries TO authenticated;
GRANT ALL ON public.overtime_entries TO service_role;
ALTER TABLE public.overtime_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ot read all auth" ON public.overtime_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ot write office+admin" ON public.overtime_entries
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.is_office(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.is_office(auth.uid()));
CREATE INDEX ON public.overtime_entries (company_id, ot_date);
CREATE INDEX ON public.overtime_entries (employee_id, ot_date);
CREATE TRIGGER ot_updated BEFORE UPDATE ON public.overtime_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== CASH ADVANCES ==============
CREATE TABLE public.cash_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  advance_date date NOT NULL,
  amount numeric NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_advances TO authenticated;
GRANT ALL ON public.cash_advances TO service_role;
ALTER TABLE public.cash_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_adv read auth" ON public.cash_advances FOR SELECT TO authenticated USING (true);
CREATE POLICY "cash_adv admin write" ON public.cash_advances FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE INDEX ON public.cash_advances (employee_id, advance_date);
CREATE TRIGGER cash_adv_updated BEFORE UPDATE ON public.cash_advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== FOOD ADVANCES (optional company tag) ==============
CREATE TABLE public.food_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  advance_date date NOT NULL,
  amount numeric NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_advances TO authenticated;
GRANT ALL ON public.food_advances TO service_role;
ALTER TABLE public.food_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_adv read auth" ON public.food_advances FOR SELECT TO authenticated USING (true);
CREATE POLICY "food_adv admin write" ON public.food_advances FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE INDEX ON public.food_advances (employee_id, advance_date);
CREATE TRIGGER food_adv_updated BEFORE UPDATE ON public.food_advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== UNIFORM ADVANCES ==============
CREATE TABLE public.uniform_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  advance_date date NOT NULL,
  amount numeric NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_advances TO authenticated;
GRANT ALL ON public.uniform_advances TO service_role;
ALTER TABLE public.uniform_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uni_adv read auth" ON public.uniform_advances FOR SELECT TO authenticated USING (true);
CREATE POLICY "uni_adv admin write" ON public.uniform_advances FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE INDEX ON public.uniform_advances (employee_id, advance_date);
CREATE TRIGGER uni_adv_updated BEFORE UPDATE ON public.uniform_advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== EXPENSE CATEGORIES (admin manages) ==============
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expcat read auth" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "expcat admin write" ON public.expense_categories FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
INSERT INTO public.expense_categories(name) VALUES
  ('Vehicle'),('Fuel'),('Services'),('Inventory Purchases'),('Tolls'),('Food'),('Other')
  ON CONFLICT DO NOTHING;

-- ============== EXPENSES ==============
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  description text,
  vendor text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp admin all" ON public.expenses FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE INDEX ON public.expenses (expense_date);
CREATE INDEX ON public.expenses (category);
CREATE TRIGGER exp_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
