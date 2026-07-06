
DROP POLICY IF EXISTS "food_adv admin write" ON public.food_advances;
DROP POLICY IF EXISTS "food_adv read auth" ON public.food_advances;

CREATE POLICY "food_adv read" ON public.food_advances
  FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

CREATE POLICY "food_adv insert" ON public.food_advances
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

CREATE POLICY "food_adv update" ON public.food_advances
  FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()))
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

CREATE POLICY "food_adv delete" ON public.food_advances
  FOR DELETE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
