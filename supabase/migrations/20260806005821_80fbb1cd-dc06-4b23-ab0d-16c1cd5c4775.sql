ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS active_ranks text[] NOT NULL DEFAULT ARRAY['OIC','SSO','JSO','LSO']::text[],
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.overtime_entries ALTER COLUMN hours TYPE numeric(6,2);

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name text NOT NULL,
  asset_category text NOT NULL,
  identifier text,
  vehicle_number text,
  serial_number text,
  quantity integer NOT NULL DEFAULT 1,
  purchase_date date,
  purchase_cost numeric NOT NULL DEFAULT 0,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  invoice_ref text,
  condition text NOT NULL DEFAULT 'Good',
  status text NOT NULL DEFAULT 'In Use',
  location text,
  assigned_to text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets read admin or office" ON public.assets FOR SELECT TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "assets insert admin or office" ON public.assets FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "assets update admin or office" ON public.assets FOR UPDATE TO authenticated
  USING (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()))
  WITH CHECK (private.is_admin_or_super(auth.uid()) OR private.is_office(auth.uid()));
CREATE POLICY "assets delete admin" ON public.assets FOR DELETE TO authenticated
  USING (private.is_admin_or_super(auth.uid()));

CREATE TRIGGER assets_updated BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_at_column();