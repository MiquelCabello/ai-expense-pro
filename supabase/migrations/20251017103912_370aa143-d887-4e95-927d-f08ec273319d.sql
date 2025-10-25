-- =========================================
-- FASE 1: CORRECCIONES DE SEGURIDAD
-- Resolver warnings del linter
-- =========================================

-- 1. Habilitar RLS en las nuevas tablas (sin políticas por ahora)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_v2 ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.companies IS 'Nueva tabla de empresas - RLS habilitado, políticas pendientes en Fase 4';
COMMENT ON TABLE public.departments IS 'Nueva tabla de departamentos - RLS habilitado, políticas pendientes en Fase 4';
COMMENT ON TABLE public.memberships IS 'Nueva tabla de membresías - RLS habilitado, políticas pendientes en Fase 4';
COMMENT ON TABLE public.profiles_v2 IS 'Nueva tabla de perfiles - RLS habilitado, políticas pendientes en Fase 4';

-- 2. Arreglar función para que tenga search_path explícito
DROP FUNCTION IF EXISTS public.update_updated_at_column_v2() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Re-crear triggers con la función corregida
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column_v2();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column_v2();

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column_v2();

CREATE TRIGGER update_profiles_v2_updated_at
  BEFORE UPDATE ON public.profiles_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column_v2();

-- 3. Reemplazar la vista SECURITY DEFINER por una función normal
DROP VIEW IF EXISTS public.migration_status_v1;

-- Crear como función SECURITY INVOKER (no DEFINER) para evitar el warning
CREATE OR REPLACE FUNCTION public.get_migration_status()
RETURNS TABLE (
  migration TEXT,
  total_original BIGINT,
  migrated_count BIGINT,
  pending_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    'accounts → companies'::TEXT,
    COUNT(*)::BIGINT,
    (SELECT COUNT(*) FROM public.companies WHERE migration_status = 'migrated')::BIGINT,
    (SELECT COUNT(*) FROM public.companies WHERE migration_status = 'pending')::BIGINT
  FROM public.accounts
  
  UNION ALL
  
  SELECT
    'account_departments → departments'::TEXT,
    COUNT(*)::BIGINT,
    (SELECT COUNT(*) FROM public.departments WHERE migrated_from_account_department_id IS NOT NULL)::BIGINT,
    0::BIGINT
  FROM public.account_departments
  
  UNION ALL
  
  SELECT
    'profiles → memberships'::TEXT,
    COUNT(*)::BIGINT,
    (SELECT COUNT(DISTINCT user_id) FROM public.memberships WHERE migrated_from_profile_id IS NOT NULL)::BIGINT,
    0::BIGINT
  FROM public.profiles
  WHERE account_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_migration_status() IS 'Función para monitorear el progreso de la migración (usar: SELECT * FROM get_migration_status())';