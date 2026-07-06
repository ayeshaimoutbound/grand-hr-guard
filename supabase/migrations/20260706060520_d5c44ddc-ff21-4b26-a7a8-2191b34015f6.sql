
-- Restrict SELECT on sensitive tables to admin/super_admin/office roles

DROP POLICY IF EXISTS "cash_adv read auth" ON public.cash_advances;
CREATE POLICY "cash_adv read auth" ON public.cash_advances
  FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

DROP POLICY IF EXISTS "inventory read all auth" ON public.inventory_items;
CREATE POLICY "inventory read all auth" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

DROP POLICY IF EXISTS "invmove read auth" ON public.inventory_movements;
CREATE POLICY "invmove read auth" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

DROP POLICY IF EXISTS "ot read all auth" ON public.overtime_entries;
CREATE POLICY "ot read all auth" ON public.overtime_entries
  FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

DROP POLICY IF EXISTS "uni_adv read auth" ON public.uniform_advances;
CREATE POLICY "uni_adv read auth" ON public.uniform_advances
  FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
