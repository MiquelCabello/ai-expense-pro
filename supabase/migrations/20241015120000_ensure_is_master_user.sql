-- Ensure the master user helper exists before dependent migrations run
CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'info@miquelcabello.com';
$$;
