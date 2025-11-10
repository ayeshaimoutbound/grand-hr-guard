-- Add email column to profiles table for username-to-email mapping
ALTER TABLE public.profiles ADD COLUMN email TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Restrict employee banking data visibility to Super Admin only
-- Drop existing broad admin policy and create separate policies
DROP POLICY IF EXISTS "Admins can view employees" ON public.employees;

-- Super admins can view all employee data including banking details
CREATE POLICY "Super admins can view all employees"
  ON public.employees
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Regular admins can view employee data but with masked sensitive banking info
-- They can see names, IDs, phone for operational needs but not full banking details
CREATE POLICY "Admins can view limited employee data"
  ON public.employees
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') 
    AND NOT public.is_super_admin(auth.uid())
  );

-- Note: For field-level masking, we'll handle this in the application layer
-- since PostgreSQL RLS operates at row level, not column level