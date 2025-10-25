-- =========================================
-- FASE 4: RLS POLICIES DUALES (con cleanup)
-- Eliminar policies existentes y recrearlas
-- =========================================

-- 1. Eliminar policies existentes de las nuevas tablas (si existen)
DROP POLICY IF EXISTS "companies_select_dual" ON public.companies;
DROP POLICY IF EXISTS "companies_update_dual" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_dual" ON public.companies;

DROP POLICY IF EXISTS "departments_select_dual" ON public.departments;
DROP POLICY IF EXISTS "departments_modify_dual" ON public.departments;
DROP POLICY IF EXISTS "departments_update_dual" ON public.departments;
DROP POLICY IF EXISTS "departments_delete_dual" ON public.departments;

DROP POLICY IF EXISTS "memberships_select_dual" ON public.memberships;
DROP POLICY IF EXISTS "memberships_insert_dual" ON public.memberships;
DROP POLICY IF EXISTS "memberships_update_dual" ON public.memberships;
DROP POLICY IF EXISTS "memberships_delete_dual" ON public.memberships;

DROP POLICY IF EXISTS "profiles_v2_select_dual" ON public.profiles_v2;
DROP POLICY IF EXISTS "profiles_v2_insert_dual" ON public.profiles_v2;
DROP POLICY IF EXISTS "profiles_v2_update_dual" ON public.profiles_v2;

-- 2. Habilitar RLS en todas las nuevas tablas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_v2 ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies para COMPANIES
CREATE POLICY "companies_select_dual" ON public.companies
FOR SELECT USING (
  public.is_master_dual()
  OR public.has_company_scope_dual(id)
  OR public.is_member_of_company_dual(id)
  OR (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.account_id = companies.migrated_from_account_id
  ))
);

CREATE POLICY "companies_update_dual" ON public.companies
FOR UPDATE USING (
  public.is_master_dual() 
  OR public.has_company_scope_dual(id)
);

CREATE POLICY "companies_insert_dual" ON public.companies
FOR INSERT WITH CHECK (
  public.is_master_dual()
);

-- 4. RLS Policies para DEPARTMENTS
CREATE POLICY "departments_select_dual" ON public.departments
FOR SELECT USING (
  public.is_master_dual() 
  OR public.is_member_of_company_dual(company_id)
);

CREATE POLICY "departments_modify_dual" ON public.departments
FOR INSERT WITH CHECK (
  public.is_master_dual() 
  OR public.has_company_scope_dual(company_id)
);

CREATE POLICY "departments_update_dual" ON public.departments
FOR UPDATE USING (
  public.is_master_dual() 
  OR public.has_company_scope_dual(company_id)
);

CREATE POLICY "departments_delete_dual" ON public.departments
FOR DELETE USING (
  public.is_master_dual() 
  OR public.has_company_scope_dual(company_id)
);

-- 5. RLS Policies para MEMBERSHIPS
CREATE POLICY "memberships_select_dual" ON public.memberships
FOR SELECT USING (
  public.is_master_dual() 
  OR public.is_member_of_company_dual(company_id)
);

CREATE POLICY "memberships_insert_dual" ON public.memberships
FOR INSERT WITH CHECK (
  public.is_master_dual() 
  OR public.has_company_scope_dual(company_id)
);

CREATE POLICY "memberships_update_dual" ON public.memberships
FOR UPDATE USING (
  public.is_master_dual() 
  OR public.has_company_scope_dual(company_id)
);

CREATE POLICY "memberships_delete_dual" ON public.memberships
FOR DELETE USING (
  public.is_master_dual() 
  OR public.has_company_scope_dual(company_id)
);

-- 6. RLS Policies para PROFILES_V2
CREATE POLICY "profiles_v2_select_dual" ON public.profiles_v2
FOR SELECT USING (
  public.is_master_dual() 
  OR user_id = auth.uid()
);

CREATE POLICY "profiles_v2_insert_dual" ON public.profiles_v2
FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "profiles_v2_update_dual" ON public.profiles_v2
FOR UPDATE USING (
  user_id = auth.uid()
);

-- 7. Función helper para verificar acceso dual
CREATE OR REPLACE FUNCTION public.has_dual_access_to_company(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.is_master_dual()
    OR public.is_member_of_company_dual(target_company_id)
    OR public.has_company_scope_dual(target_company_id)
    OR EXISTS (
      SELECT 1 FROM public.companies c
      INNER JOIN public.profiles p ON p.account_id = c.migrated_from_account_id
      WHERE c.id = target_company_id
        AND p.user_id = auth.uid()
    )
  );
$$;

COMMENT ON FUNCTION public.has_dual_access_to_company IS 'Verifica acceso a empresa en ambos sistemas (dual)';

-- 8. Vista de auditoría de permisos
CREATE OR REPLACE VIEW public.user_permissions_dual AS
SELECT
  auth.uid() AS current_user_id,
  c.id AS company_id,
  c.name AS company_name,
  m.role AS role_new_system,
  p.role AS role_old_system,
  public.has_company_scope_dual(c.id) AS has_company_scope,
  public.is_member_of_company_dual(c.id) AS is_member,
  public.is_master_dual() AS is_master
FROM public.companies c
LEFT JOIN public.memberships m ON m.company_id = c.id AND m.user_id = auth.uid()
LEFT JOIN public.profiles p ON p.account_id = c.migrated_from_account_id AND p.user_id = auth.uid()
WHERE 
  public.has_dual_access_to_company(c.id);

COMMENT ON VIEW public.user_permissions_dual IS 'Vista de auditoría de permisos del usuario actual en ambos sistemas';