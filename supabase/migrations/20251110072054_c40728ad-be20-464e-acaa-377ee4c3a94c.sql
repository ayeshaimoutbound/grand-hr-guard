-- Add invoice-related fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS charge_oic numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS charge_sso numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS charge_jso numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS charge_lso numeric NOT NULL DEFAULT 0;

-- Create invoices table for Finance Module
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  month_period date NOT NULL,
  amount_to_collect numeric NOT NULL DEFAULT 0,
  amount_received numeric NOT NULL DEFAULT 0,
  invoice_sent boolean NOT NULL DEFAULT false,
  printed boolean NOT NULL DEFAULT false,
  emailed boolean NOT NULL DEFAULT false,
  invoice_data jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Admins can view invoices"
ON public.invoices
FOR SELECT
USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can create invoices"
ON public.invoices
FOR INSERT
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Super admins can update invoices"
ON public.invoices
FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete invoices"
ON public.invoices
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();