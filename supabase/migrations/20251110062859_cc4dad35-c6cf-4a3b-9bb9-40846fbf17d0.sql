-- Create a secure function to get email by username
-- This bypasses RLS policies safely using security definer
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where username = p_username
  limit 1
$$;

-- Lock down permissions - only allow anon and authenticated roles to execute
revoke all on function public.get_email_by_username(text) from public;
grant execute on function public.get_email_by_username(text) to anon, authenticated;