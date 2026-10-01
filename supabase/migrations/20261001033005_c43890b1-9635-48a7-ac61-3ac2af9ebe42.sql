CREATE TABLE public.employee_rate_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rank public.rank NOT NULL,
  pay_rate numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, company_id, rank)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_rate_overrides TO authenticated;
GRANT ALL ON public.employee_rate_overrides TO service_role;
ALTER TABLE public.employee_rate_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate overrides read" ON public.employee_rate_overrides FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "rate overrides manage" ON public.employee_rate_overrides FOR ALL TO authenticated USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));
CREATE TRIGGER ero_updated BEFORE UPDATE ON public.employee_rate_overrides FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('company','employee')),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents read" ON public.documents FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "documents insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "documents delete" ON public.documents FOR DELETE TO authenticated USING (private.is_admin_or_super(auth.uid()));

CREATE TABLE public.employee_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  complaint_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  proof_path text,
  proof_name text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_complaints TO authenticated;
GRANT ALL ON public.employee_complaints TO service_role;
ALTER TABLE public.employee_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints read" ON public.employee_complaints FOR SELECT TO authenticated USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "complaints insert" ON public.employee_complaints FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "complaints delete" ON public.employee_complaints FOR DELETE TO authenticated USING (private.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION private.prevent_double_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE other_name text;
BEGIN
  IF NEW.present IS DISTINCT FROM true THEN RETURN NEW; END IF;
  SELECT c.company_name INTO other_name FROM public.attendance a JOIN public.companies c ON c.id = a.company_id
  WHERE a.employee_id = NEW.employee_id AND a.attendance_date = NEW.attendance_date
    AND a.shift_type = NEW.shift_type AND a.present = true AND a.id <> NEW.id LIMIT 1;
  IF other_name IS NOT NULL THEN
    RAISE EXCEPTION 'DOUBLE_BOOKING: This employee is already on the % shift on % at %', NEW.shift_type, NEW.attendance_date, other_name;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_no_double_booking BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.prevent_double_booking();

CREATE POLICY "docs storage read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='documents' AND (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid())));
CREATE POLICY "docs storage insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='documents' AND (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid())));
CREATE POLICY "docs storage delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='documents' AND private.is_admin_or_super(auth.uid()));