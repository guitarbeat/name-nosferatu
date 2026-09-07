-- Function: is_admin
-- Description: Checks if the current user has the admin role.
-- FIX is_admin(): auth.uid() primary, JWT user_metadata fallback (both secure)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Primary: check user_id = auth.uid() (linked after first login via link_auth_uid)
  IF EXISTS (
    SELECT 1 FROM public.cat_user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Secondary: user_name from JWT user_metadata (signed by Supabase — not client-settable)
  RETURN EXISTS (
    SELECT 1 FROM public.cat_user_roles
    WHERE user_name = (auth.jwt() -> 'user_metadata' ->> 'user_name')
      AND role = 'admin'
      AND (auth.jwt() -> 'user_metadata' ->> 'user_name') IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
