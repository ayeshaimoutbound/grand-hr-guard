
-- Helper: is the user an "office" user
CREATE OR REPLACE FUNCTION public.is_office(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'office'
  )
$$;

-- Employees: allow office to view limited data and insert
CREATE POLICY "Office can view limited employees"
ON public.employees FOR SELECT TO authenticated
USING (public.is_office(auth.uid()));

CREATE POLICY "Office can add employees"
ON public.employees FOR INSERT TO authenticated
WITH CHECK (public.is_office(auth.uid()));

-- Attendance: full management for office
CREATE POLICY "Office can manage attendance"
ON public.attendance FOR ALL TO authenticated
USING (public.is_office(auth.uid()))
WITH CHECK (public.is_office(auth.uid()));

-- Invoices: office can view and update (not insert/delete)
CREATE POLICY "Office can view invoices"
ON public.invoices FOR SELECT TO authenticated
USING (public.is_office(auth.uid()));

CREATE POLICY "Office can update invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (public.is_office(auth.uid()))
WITH CHECK (public.is_office(auth.uid()));

-- Companies: office needs read access for invoices
CREATE POLICY "Office can view companies"
ON public.companies FOR SELECT TO authenticated
USING (public.is_office(auth.uid()));

-- Invoice payments: office can view (needed when loading invoice details)
CREATE POLICY "Office can view invoice payments"
ON public.invoice_payments FOR SELECT TO authenticated
USING (public.is_office(auth.uid()));
