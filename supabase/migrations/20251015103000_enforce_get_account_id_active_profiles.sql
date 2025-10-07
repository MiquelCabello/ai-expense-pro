-- Ensure get_account_id ignores inactive profiles
CREATE OR REPLACE FUNCTION public.get_account_id(_uid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.profiles
  WHERE user_id = _uid
    AND status = 'ACTIVE'::public.user_status
  ORDER BY created_at DESC
  LIMIT 1;
$$;
