-- Allow office role to create/edit/delete salary advances (cash_advances)
DROP POLICY IF EXISTS "cash_adv office write" ON public.cash_advances;
CREATE POLICY "cash_adv office write"
  ON public.cash_advances
  FOR ALL
  TO authenticated
  USING (private.is_office(auth.uid()))
  WITH CHECK (private.is_office(auth.uid()));

-- Enforce one invoice per company/month
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_month_uniq
  ON public.invoices (company_id, month_period);

-- Enforce one salary row per (employee, company, month)
CREATE UNIQUE INDEX IF NOT EXISTS salaries_emp_company_month_uniq
  ON public.salaries (employee_id, company_id, salary_month);
