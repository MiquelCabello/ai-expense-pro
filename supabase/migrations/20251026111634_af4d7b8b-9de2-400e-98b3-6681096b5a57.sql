-- Función para obtener las empresas de una cuenta
CREATE OR REPLACE FUNCTION public.get_account_companies(a_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.companies WHERE account_id = a_id;
$$;

-- Función para verificar si el usuario es admin de grupo empresarial
CREATE OR REPLACE FUNCTION public.is_group_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.account_memberships am
    INNER JOIN public.accounts a ON a.id = am.account_id
    WHERE am.user_id = auth.uid()
      AND am.role = 'account_owner'
  );
$$;

-- Función para contar empresas de una cuenta
CREATE OR REPLACE FUNCTION public.count_account_companies(a_id UUID)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.companies WHERE account_id = a_id;
$$;