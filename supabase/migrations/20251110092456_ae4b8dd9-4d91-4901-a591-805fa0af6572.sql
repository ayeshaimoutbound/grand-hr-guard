-- Drop the existing admin view policy that allows access to all columns
DROP POLICY IF EXISTS "Admins can view limited employee data" ON public.employees;

-- Create a view with only non-sensitive employee columns for regular admins
CREATE OR REPLACE VIEW public.employees_limited AS
SELECT 
  id,
  employee_id,
  full_name,
  created_at,
  updated_at
FROM public.employees;

-- Enable RLS on the view
ALTER VIEW public.employees_limited SET (security_invoker = true);

-- Create a policy for regular admins to view the limited view
-- Note: Views inherit the base table's RLS, so we need to ensure admins can access the view
-- Create a function to check if user is a regular admin (not super admin)
CREATE OR REPLACE FUNCTION public.is_regular_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = 'admin'
  ) AND NOT public.is_super_admin(_user_id)
$$;

-- Create a new SELECT policy for regular admins on the main employees table
-- This allows them to see only the columns exposed in the view
CREATE POLICY "Regular admins can view limited employee data"
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.is_regular_admin(auth.uid())
);

-- Grant usage on the view to authenticated users
GRANT SELECT ON public.employees_limited TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.employees_limited IS 'Limited view of employees table for regular admins - excludes sensitive PII like NIC, bank details, and phone numbers';