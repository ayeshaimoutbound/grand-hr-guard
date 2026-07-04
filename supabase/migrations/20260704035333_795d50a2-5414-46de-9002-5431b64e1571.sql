
-- 1. Private schema + helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.has_role(_user_id, 'super_admin'::public.app_role) $$;

CREATE OR REPLACE FUNCTION private.is_admin_or_super(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)) $$;

CREATE OR REPLACE FUNCTION private.is_office(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'office'::public.app_role) $$;

CREATE OR REPLACE FUNCTION private.is_regular_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::public.app_role) AND NOT private.is_super_admin(_user_id) $$;

CREATE OR REPLACE FUNCTION private.get_email_by_username(p_username text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT email FROM public.profiles WHERE username = p_username LIMIT 1 $$;

CREATE OR REPLACE FUNCTION private.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION private.update_invoice_amount_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
  SET amount_received = (SELECT COALESCE(SUM(amount), 0) FROM public.invoice_payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id))
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin_or_super(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_office(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_regular_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_email_by_username(text) TO anon, authenticated, service_role;

-- 2. Drop always-true policies explicitly (CASCADE below only drops function-dependent policies)
DROP POLICY IF EXISTS "inventory insert auth" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory update auth" ON public.inventory_items;
DROP POLICY IF EXISTS "invmove insert auth" ON public.inventory_movements;
DROP POLICY IF EXISTS "Office can view manual deductions" ON public.salary_manual_deductions;

-- 3. Drop old public helpers (cascades role-check policies + triggers referencing them)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_super(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_office(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_regular_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_invoice_amount_received() CASCADE;
DROP FUNCTION IF EXISTS public.get_email_by_username(text) CASCADE;

-- 4. Public wrapper for get_email_by_username (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.get_email_by_username(p_username) $$;
REVOKE ALL ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated, service_role;

-- 5. Recreate triggers
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER cash_adv_updated BEFORE UPDATE ON public.cash_advances FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER exp_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER food_adv_updated BEFORE UPDATE ON public.food_advances FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER inventory_items_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER update_invoice_payments_updated_at BEFORE UPDATE ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER update_invoice_on_payment_insert AFTER INSERT ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION private.update_invoice_amount_received();
CREATE TRIGGER update_invoice_on_payment_update AFTER UPDATE ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION private.update_invoice_amount_received();
CREATE TRIGGER update_invoice_on_payment_delete AFTER DELETE ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION private.update_invoice_amount_received();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER ot_updated BEFORE UPDATE ON public.overtime_entries FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON public.salaries FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER trg_smd_updated BEFORE UPDATE ON public.salary_manual_deductions FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER uni_adv_updated BEFORE UPDATE ON public.uniform_advances FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();
CREATE TRIGGER uma_updated BEFORE UPDATE ON public.user_module_access FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();

-- 6. Recreate role-based RLS policies (cascaded from function drops)
CREATE POLICY "settings managed by admin" ON public.app_settings FOR ALL TO authenticated
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can manage attendance" ON public.attendance FOR ALL TO authenticated USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can view attendance" ON public.attendance FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Office can manage attendance" ON public.attendance FOR ALL TO authenticated USING (private.is_office(auth.uid())) WITH CHECK (private.is_office(auth.uid()));

CREATE POLICY "cash_adv admin write" ON public.cash_advances FOR ALL TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can add companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can view companies" ON public.companies FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Office can view companies" ON public.companies FOR SELECT TO authenticated USING (private.is_office(auth.uid()));
CREATE POLICY "Super admins can delete companies" ON public.companies FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can update companies" ON public.companies FOR UPDATE TO authenticated USING (private.is_super_admin(auth.uid()));

CREATE POLICY "Admins can add employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Office can add employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (private.is_office(auth.uid()));
CREATE POLICY "Office can view limited employees" ON public.employees FOR SELECT TO authenticated USING (private.is_office(auth.uid()));
CREATE POLICY "Regular admins can view limited employee data" ON public.employees FOR SELECT TO authenticated USING (private.is_regular_admin(auth.uid()));
CREATE POLICY "Super admins can delete employees" ON public.employees FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can update employees" ON public.employees FOR UPDATE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can view all employees" ON public.employees FOR SELECT TO authenticated USING (private.is_super_admin(auth.uid()));

CREATE POLICY "expcat admin write" ON public.expense_categories FOR ALL TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

CREATE POLICY "exp admin all" ON public.expenses FOR ALL TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

CREATE POLICY "food_adv admin write" ON public.food_advances FOR ALL TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

-- inventory_items: keep existing SELECT policy ("inventory read all auth"), add tightened INSERT/UPDATE + admin delete
CREATE POLICY "inventory delete admin" ON public.inventory_items FOR DELETE TO authenticated USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "inventory insert admin or office" ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "inventory update admin or office" ON public.inventory_items FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()))
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

-- inventory_movements: keep existing SELECT policy; add tightened INSERT + admin delete
CREATE POLICY "invmove delete admin" ON public.inventory_movements FOR DELETE TO authenticated USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "invmove insert admin or office" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

CREATE POLICY "Admins can add payments" ON public.invoice_payments FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can view payments" ON public.invoice_payments FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Office can view invoice payments" ON public.invoice_payments FOR SELECT TO authenticated USING (private.is_office(auth.uid()));
CREATE POLICY "Super admins can delete payments" ON public.invoice_payments FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can update payments" ON public.invoice_payments FOR UPDATE TO authenticated USING (private.is_super_admin(auth.uid()));

CREATE POLICY "Admins can create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can view invoices" ON public.invoices FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Super admins can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (private.is_super_admin(auth.uid()));

CREATE POLICY "ot write office+admin" ON public.overtime_entries FOR ALL TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()))
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

CREATE POLICY "Super admins can create profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (private.is_super_admin(auth.uid()));

CREATE POLICY "Admins can add salaries" ON public.salaries FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can view salaries" ON public.salaries FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Super admins can delete salaries" ON public.salaries FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can update salaries" ON public.salaries FOR UPDATE TO authenticated USING (private.is_super_admin(auth.uid()));

CREATE POLICY "Admins manage manual deductions" ON public.salary_manual_deductions FOR ALL TO authenticated
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

CREATE POLICY "uni_adv admin write" ON public.uniform_advances FOR ALL TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

CREATE POLICY "uma manage superadmin" ON public.user_module_access FOR ALL TO authenticated USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()));
CREATE POLICY "uma read own" ON public.user_module_access FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR private.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.is_super_admin(auth.uid()));
