-- =========================================
-- FASE 3: MIGRACIÓN DE DATOS
-- Copiar datos del sistema antiguo al nuevo
-- =========================================

-- 1. Migrar accounts → companies
INSERT INTO public.companies (
  id,
  name,
  plan,
  category_limit,
  owner_user_id,
  max_employees,
  monthly_expense_limit,
  global_admin_limit,
  department_admin_limit,
  migrated_from_account_id,
  migration_status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() AS id, -- Nuevo ID para company
  a.name,
  CASE a.plan
    WHEN 'FREE' THEN 'free'::plan_tier
    WHEN 'PROFESSIONAL' THEN 'pro'::plan_tier
    WHEN 'ENTERPRISE' THEN 'enterprise'::plan_tier
    ELSE 'free'::plan_tier
  END AS plan,
  CASE
    WHEN a.plan = 'PROFESSIONAL' THEN COALESCE(a.max_employees, 4)
    ELSE NULL
  END AS category_limit,
  a.owner_user_id,
  a.max_employees,
  a.monthly_expense_limit,
  a.global_admin_limit,
  a.department_admin_limit,
  a.id AS migrated_from_account_id, -- Tracking
  'migrated' AS migration_status,
  a.created_at,
  a.updated_at
FROM public.accounts a
ON CONFLICT (migrated_from_account_id) DO NOTHING;

-- 2. Migrar account_departments → departments
INSERT INTO public.departments (
  id,
  company_id,
  name,
  created_at,
  updated_at,
  migrated_from_account_department_id
)
SELECT
  gen_random_uuid() AS id, -- Nuevo ID para department
  c.id AS company_id, -- Obtener el nuevo company_id
  ad.name,
  ad.created_at,
  ad.updated_at,
  ad.id AS migrated_from_account_department_id -- Tracking
FROM public.account_departments ad
INNER JOIN public.companies c ON c.migrated_from_account_id = ad.account_id
ON CONFLICT (migrated_from_account_department_id) DO NOTHING;

-- 3. Migrar auth.users → profiles_v2
INSERT INTO public.profiles_v2 (user_id, email, created_at, updated_at)
SELECT 
  id AS user_id,
  email,
  created_at,
  now() AS updated_at
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 4. Migrar profiles → memberships (usuarios con account_id)
-- Mapeo de roles: ADMIN → owner, EMPLOYEE → employee, DEPARTMENT_ADMIN → department_admin
INSERT INTO public.memberships (
  user_id,
  company_id,
  role,
  department_id,
  created_at,
  updated_at,
  migrated_from_profile_id
)
SELECT
  p.user_id,
  c.id AS company_id, -- Obtener el nuevo company_id
  CASE p.role
    WHEN 'ADMIN' THEN 'owner'::role_type
    WHEN 'EMPLOYEE' THEN 'employee'::role_type
    WHEN 'DEPARTMENT_ADMIN' THEN 'department_admin'::role_type
    ELSE 'employee'::role_type
  END AS role,
  d.id AS department_id, -- Mapear al nuevo department_id si existe
  p.created_at,
  p.updated_at,
  p.id AS migrated_from_profile_id -- Tracking
FROM public.profiles p
INNER JOIN public.companies c ON c.migrated_from_account_id = p.account_id
LEFT JOIN public.departments d ON d.migrated_from_account_department_id = p.department_id
WHERE p.account_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 5. Migrar user_roles → memberships (roles adicionales)
-- Mapeo: account_owner → owner, account_admin → company_admin, 
--        department_admin → department_admin, employee → employee
INSERT INTO public.memberships (
  user_id,
  company_id,
  role,
  department_id,
  created_at,
  updated_at,
  migrated_from_user_role_id
)
SELECT
  ur.user_id,
  c.id AS company_id, -- Obtener el nuevo company_id
  CASE ur.role
    WHEN 'account_owner' THEN 'owner'::role_type
    WHEN 'account_admin' THEN 'company_admin'::role_type
    WHEN 'department_admin' THEN 'department_admin'::role_type
    WHEN 'employee' THEN 'employee'::role_type
    ELSE 'employee'::role_type
  END AS role,
  d.id AS department_id, -- Mapear al nuevo department_id si existe
  ur.created_at,
  ur.updated_at,
  ur.id AS migrated_from_user_role_id -- Tracking
FROM public.user_roles ur
INNER JOIN public.companies c ON c.migrated_from_account_id = ur.account_id
LEFT JOIN public.departments d ON d.migrated_from_account_department_id = ur.department_id
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 6. Vista actualizada de estado de migración
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
  (SELECT COUNT(*) FROM auth.users WHERE email IS NOT NULL),
  (SELECT COUNT(*) FROM public.profiles_v2),
  ROUND(
    (SELECT COUNT(*)::NUMERIC FROM public.profiles_v2) * 100.0 / 
    NULLIF((SELECT COUNT(*) FROM auth.users WHERE email IS NOT NULL), 0),
    2
  );

COMMENT ON VIEW public.migration_status_detailed IS 'Vista detallada del progreso de migración con porcentajes';