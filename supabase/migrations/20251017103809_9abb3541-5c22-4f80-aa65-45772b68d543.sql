-- =========================================
-- FASE 1: PREPARACIÓN - TABLAS NUEVAS
-- Sin impacto en el sistema actual
-- =========================================

-- 1. Crear nuevos enums unificados
CREATE TYPE role_type AS ENUM (
  'owner',
  'employee', 
  'company_admin',
  'department_admin',
  'global_admin'
);

CREATE TYPE plan_tier AS ENUM (
  'free',
  'pro',
  'enterprise'
);

-- 2. Tabla companies (paralela a accounts)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan plan_tier NOT NULL DEFAULT 'free',
  category_limit INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Tracking de migración
  migrated_from_account_id UUID UNIQUE,
  migration_status TEXT DEFAULT 'pending',
  
  -- Límites específicos del plan (heredados de accounts)
  max_employees INT,
  monthly_expense_limit INT,
  global_admin_limit INT,
  department_admin_limit INT
);

COMMENT ON TABLE public.companies IS 'Nueva tabla de empresas - reemplazo de accounts';
COMMENT ON COLUMN public.companies.migrated_from_account_id IS 'ID de la tabla accounts original para tracking';

-- 3. Tabla departments (renombrada de account_departments)
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Tracking de migración
  migrated_from_account_department_id UUID UNIQUE,
  
  UNIQUE (company_id, name)
);

COMMENT ON TABLE public.departments IS 'Nueva tabla de departamentos - reemplazo de account_departments';

-- 4. Tabla memberships (sustituye profiles + user_roles)
CREATE TABLE public.memberships (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role role_type NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Tracking de origen
  migrated_from_profile_id UUID,
  migrated_from_user_role_id UUID,
  
  PRIMARY KEY (user_id, company_id),
  
  -- Constraints de validación
  CONSTRAINT department_required_for_dept_admin CHECK (
    (role <> 'department_admin') OR (department_id IS NOT NULL)
  ),
  CONSTRAINT department_null_for_non_dept_admin CHECK (
    (role = 'department_admin') OR (department_id IS NULL)
  )
);

COMMENT ON TABLE public.memberships IS 'Nueva tabla unificada de membresías - reemplazo de profiles + user_roles';
COMMENT ON COLUMN public.memberships.role IS 'Rol unificado del usuario en la empresa';

-- 5. Tabla profiles_v2 (minimalista, solo email para funciones)
CREATE TABLE public.profiles_v2 (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles_v2 IS 'Nueva tabla minimalista de perfiles - solo para cache de email';

-- 6. Índices para performance
CREATE INDEX idx_companies_owner ON public.companies(owner_user_id);
CREATE INDEX idx_companies_migration ON public.companies(migrated_from_account_id) WHERE migrated_from_account_id IS NOT NULL;

CREATE INDEX idx_departments_company ON public.departments(company_id);
CREATE INDEX idx_departments_migration ON public.departments(migrated_from_account_department_id) WHERE migrated_from_account_department_id IS NOT NULL;

CREATE INDEX idx_memberships_company_role ON public.memberships(company_id, role);
CREATE INDEX idx_memberships_user ON public.memberships(user_id);
CREATE INDEX idx_memberships_department ON public.memberships(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_memberships_migration_profile ON public.memberships(migrated_from_profile_id) WHERE migrated_from_profile_id IS NOT NULL;

CREATE INDEX idx_profiles_v2_email ON public.profiles_v2(email);

-- 7. Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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

-- 8. Vista para verificación de migración
CREATE VIEW public.migration_status_v1 AS
SELECT
  'accounts → companies' AS migration,
  COUNT(*) AS total_original,
  (SELECT COUNT(*) FROM public.companies WHERE migration_status = 'migrated') AS migrated_count,
  (SELECT COUNT(*) FROM public.companies WHERE migration_status = 'pending') AS pending_count
FROM public.accounts
UNION ALL
SELECT
  'account_departments → departments',
  COUNT(*),
  (SELECT COUNT(*) FROM public.departments WHERE migrated_from_account_department_id IS NOT NULL),
  0
FROM public.account_departments
UNION ALL
SELECT
  'profiles → memberships',
  COUNT(*),
  (SELECT COUNT(DISTINCT user_id) FROM public.memberships WHERE migrated_from_profile_id IS NOT NULL),
  0
FROM public.profiles
WHERE account_id IS NOT NULL;

COMMENT ON VIEW public.migration_status_v1 IS 'Vista para monitorear el progreso de la migración';