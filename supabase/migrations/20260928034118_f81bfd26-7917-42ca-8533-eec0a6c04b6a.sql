CREATE TABLE public.company_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  effective_month date NOT NULL,
  pay_oic numeric NOT NULL DEFAULT 0, pay_sso numeric NOT NULL DEFAULT 0,
  pay_jso numeric NOT NULL DEFAULT 0, pay_lso numeric NOT NULL DEFAULT 0,
  charge_oic numeric NOT NULL DEFAULT 0, charge_sso numeric NOT NULL DEFAULT 0,
  charge_jso numeric NOT NULL DEFAULT 0, charge_lso numeric NOT NULL DEFAULT 0,
  client_ot_rate numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, effective_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_rate_history TO authenticated;
GRANT ALL ON public.company_rate_history TO service_role;
ALTER TABLE public.company_rate_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and office can view rate history" ON public.company_rate_history FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "Admins can insert rate history" ON public.company_rate_history FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can update rate history" ON public.company_rate_history FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can delete rate history" ON public.company_rate_history FOR DELETE TO authenticated
  USING (private.is_admin_or_super(auth.uid()));
CREATE OR REPLACE FUNCTION public.touch_company_rate_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER touch_company_rate_history BEFORE UPDATE ON public.company_rate_history
  FOR EACH ROW EXECUTE FUNCTION public.touch_company_rate_history();