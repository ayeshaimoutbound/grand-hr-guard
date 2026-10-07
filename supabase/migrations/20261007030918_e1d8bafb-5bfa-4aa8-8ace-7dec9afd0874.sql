ALTER TABLE public.employee_complaints ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE public.employee_complaints ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.employee_complaints ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ongoing';
ALTER TABLE public.employee_complaints ADD COLUMN IF NOT EXISTS closed_at timestamptz;
GRANT UPDATE ON public.employee_complaints TO authenticated;
CREATE POLICY "complaints update" ON public.employee_complaints FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()))
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));

CREATE TABLE public.complaint_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.employee_complaints(id) ON DELETE CASCADE,
  note text,
  file_path text,
  file_name text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.complaint_updates TO authenticated;
GRANT ALL ON public.complaint_updates TO service_role;
ALTER TABLE public.complaint_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cu read" ON public.complaint_updates FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "cu insert" ON public.complaint_updates FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "cu delete" ON public.complaint_updates FOR DELETE TO authenticated
  USING (private.is_admin_or_super(auth.uid()));