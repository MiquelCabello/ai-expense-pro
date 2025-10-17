-- =====================================================
-- Corrección Final: Function Search Path
-- =====================================================

-- Recrear get_migration_status con search_path seguro
CREATE OR REPLACE FUNCTION public.get_migration_status()
RETURNS TABLE(migration text, total_original bigint, migrated_count bigint, pending_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'accounts → companies'::TEXT,
    COUNT(*)::BIGINT,
    (SELECT COUNT(*) FROM public.companies WHERE migration_status = 'migrated')::BIGINT,
    (SELECT COUNT(*) FROM public.companies WHERE migration_status = 'pending')::BIGINT
  FROM public.companies
  WHERE migrated_from_account_id IS NOT NULL
  
  UNION ALL
  
  SELECT
    'account_departments → departments'::TEXT,
    COUNT(*)::BIGINT,
    (SELECT COUNT(*) FROM public.departments WHERE migrated_from_account_department_id IS NOT NULL)::BIGINT,
    0::BIGINT
  FROM public.departments
  WHERE migrated_from_account_department_id IS NOT NULL
  
  UNION ALL
  
  SELECT
    'profiles → memberships'::TEXT,
    COUNT(*)::BIGINT,
    (SELECT COUNT(DISTINCT user_id) FROM public.memberships WHERE migrated_from_profile_id IS NOT NULL)::BIGINT,
    0::BIGINT
  FROM public.memberships
  WHERE migrated_from_profile_id IS NOT NULL;
$$;

-- =====================================================
-- Resultado: Función corregida con search_path seguro
-- =====================================================