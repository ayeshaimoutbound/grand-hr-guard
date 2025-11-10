-- Add missing INSERT policy for profiles table
CREATE POLICY "Super admins can create profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));