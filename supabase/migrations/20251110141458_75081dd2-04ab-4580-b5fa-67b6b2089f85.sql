-- Create invoice_payments table to track individual payments
CREATE TABLE public.invoice_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Cheque', 'Bank Transfer')),
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_payments
CREATE POLICY "Admins can view payments"
  ON public.invoice_payments
  FOR SELECT
  USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can add payments"
  ON public.invoice_payments
  FOR INSERT
  WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Super admins can update payments"
  ON public.invoice_payments
  FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete payments"
  ON public.invoice_payments
  FOR DELETE
  USING (is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_invoice_payments_updated_at
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update invoice amount_received based on payments
CREATE OR REPLACE FUNCTION public.update_invoice_amount_received()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the invoice's amount_received to sum of all payments
  UPDATE public.invoices
  SET amount_received = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.invoice_payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
  )
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers to auto-update invoice amount_received
CREATE TRIGGER update_invoice_on_payment_insert
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoice_amount_received();

CREATE TRIGGER update_invoice_on_payment_update
  AFTER UPDATE ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoice_amount_received();

CREATE TRIGGER update_invoice_on_payment_delete
  AFTER DELETE ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoice_amount_received();

-- Add index for better query performance
CREATE INDEX idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_payment_date ON public.invoice_payments(payment_date DESC);