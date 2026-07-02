
CREATE TABLE public.salary_manual_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_month DATE NOT NULL,
  food NUMERIC NOT NULL DEFAULT 0,
  uniforms NUMERIC NOT NULL DEFAULT 0,
  accommodation NUMERIC NOT NULL DEFAULT 0,
  transport NUMERIC NOT NULL DEFAULT 0,
  other NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, salary_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_manual_deductions TO authenticated;
GRANT ALL ON public.salary_manual_deductions TO service_role;

ALTER TABLE public.salary_manual_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage manual deductions"
  ON public.salary_manual_deductions FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Office can view manual deductions"
  ON public.salary_manual_deductions FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_smd_updated
  BEFORE UPDATE ON public.salary_manual_deductions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
