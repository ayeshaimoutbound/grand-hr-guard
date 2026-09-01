-- 1. Make username -> email lookup resilient when profiles.email is empty
CREATE OR REPLACE FUNCTION private.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public, auth
AS $$
  SELECT COALESCE(p.email, u.email)
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE lower(p.username) = lower(p_username)
  LIMIT 1
$$;

-- 2. Backfill missing profile emails from auth
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND (p.email IS NULL OR p.email = '');

-- 3. Employee number optional
ALTER TABLE public.employees ALTER COLUMN employee_id DROP NOT NULL;
