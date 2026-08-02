-- app_settings: only admin/super/office may read (was: every authenticated user)
DROP POLICY IF EXISTS "settings readable by authenticated" ON public.app_settings;
CREATE POLICY "settings readable by staff" ON public.app_settings
FOR SELECT TO authenticated
USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

-- expense_categories: restrict reference data reads to admin/super only
DROP POLICY IF EXISTS "expcat read auth" ON public.expense_categories;
CREATE POLICY "expcat read admin" ON public.expense_categories
FOR SELECT TO authenticated
USING (private.is_admin_or_super(auth.uid()));

-- cash_advances: office may read + create, only admin/super may modify, only super admin may delete
DROP POLICY IF EXISTS "cash_adv office write" ON public.cash_advances;
DROP POLICY IF EXISTS "cash_adv admin write" ON public.cash_advances;
CREATE POLICY "cash_adv insert staff" ON public.cash_advances
FOR INSERT TO authenticated
WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "cash_adv update admin" ON public.cash_advances
FOR UPDATE TO authenticated
USING (private.is_admin_or_super(auth.uid()))
WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "cash_adv delete super" ON public.cash_advances
FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()));

-- expenses: split blanket ALL policy; deletion restricted to super admin
DROP POLICY IF EXISTS "exp admin all" ON public.expenses;
CREATE POLICY "exp select admin" ON public.expenses
FOR SELECT TO authenticated
USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "exp insert admin" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "exp update admin" ON public.expenses
FOR UPDATE TO authenticated
USING (private.is_admin_or_super(auth.uid()))
WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "exp delete super" ON public.expenses
FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()));

-- uniform_advances: make the access model explicit and consistent
DROP POLICY IF EXISTS "uni_adv admin write" ON public.uniform_advances;
CREATE POLICY "uni_adv insert admin" ON public.uniform_advances
FOR INSERT TO authenticated
WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "uni_adv update admin" ON public.uniform_advances
FOR UPDATE TO authenticated
USING (private.is_admin_or_super(auth.uid()))
WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "uni_adv delete super" ON public.uniform_advances
FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()));