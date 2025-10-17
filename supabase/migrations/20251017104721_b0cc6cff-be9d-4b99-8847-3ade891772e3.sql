-- Fix ERROR 1: Exposed Auth Users
-- Eliminar referencias directas a auth.users en las vistas públicas

-- Recrear la vista sin exponer auth.users
CREATE OR REPLACE VIEW public.migration_status_detailed AS
SELECT
  'Cuentas/Empresas' AS entidad,
  (SELECT COUNT(*) FROM public.accounts) AS total_original,
  (SELECT COUNT(*) FROM public.companies WHERE migration_status = 'migrated') AS migrados,
  ROUND(
    (SELECT COUNT(*)::NUMERIC FROM public.companies WHERE migration_status = 'migrated') * 100.0 / 
    NULLIF((SELECT COUNT(*) FROM public.accounts), 0),
    2
  ) AS porcentaje_completado
UNION ALL
SELECT
  'Departamentos',
  (SELECT COUNT(*) FROM public.account_departments),
  (SELECT COUNT(*) FROM public.departments WHERE migrated_from_account_department_id IS NOT NULL),
  ROUND(
    (SELECT COUNT(*)::NUMERIC FROM public.departments WHERE migrated_from_account_department_id IS NOT NULL) * 100.0 / 
    NULLIF((SELECT COUNT(*) FROM public.account_departments), 0),
    2
  )
UNION ALL
SELECT
  'Usuarios (profiles)',
  (SELECT COUNT(*) FROM public.profiles WHERE account_id IS NOT NULL),
  (SELECT COUNT(DISTINCT user_id) FROM public.memberships WHERE migrated_from_profile_id IS NOT NULL),
  ROUND(
    (SELECT COUNT(DISTINCT user_id)::NUMERIC FROM public.memberships WHERE migrated_from_profile_id IS NOT NULL) * 100.0 / 
    NULLIF((SELECT COUNT(*) FROM public.profiles WHERE account_id IS NOT NULL), 0),
    2
  )
UNION ALL
SELECT
  'Roles adicionales',
  (SELECT COUNT(*) FROM public.user_roles),
  (SELECT COUNT(*) FROM public.memberships WHERE migrated_from_user_role_id IS NOT NULL),
  ROUND(
    (SELECT COUNT(*)::NUMERIC FROM public.memberships WHERE migrated_from_user_role_id IS NOT NULL) * 100.0 / 
    NULLIF((SELECT COUNT(*) FROM public.user_roles), 0),
    2
  )
UNION ALL
SELECT
  'Perfiles de usuario',
  (SELECT COUNT(*) FROM public.profiles_v2),
  (SELECT COUNT(*) FROM public.profiles_v2),
  100.00 AS porcentaje_completado;

COMMENT ON VIEW public.migration_status_detailed IS 'Vista detallada del progreso de migración con porcentajes (sin exponer auth.users)';