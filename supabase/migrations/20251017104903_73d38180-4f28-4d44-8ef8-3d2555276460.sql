-- =========================================
-- FASE 4: RLS POLICIES DUALES
-- Políticas para las nuevas tablas sin tocar las antiguas
-- =========================================

-- 1. RLS Policies para COMPANIES
-- Select: master, miembros de la empresa, o usuarios con alcance de empresa
CREATE POLICY "companies_select_dual" ON public.companies
FOR SELECT USING (
  public.is_master_dual()
  OR public.has_company_scope_dual(id)
  OR public.is_member_of_company_dual(id)
  -- Fallback: usuarios del sistema antiguo con access a la cuenta migrada
  OR (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.account_id = companies.migrated_from_account_id
  ))
);

-- Update: solo master o usuarios con alcance de empresa
CREATE POLICY "companies_update_dual" ON public.companies
FOR UPDATE USING (
  public.is_master_dual() 
  OR public.has_company_scope_dual(id)
);

-- Insert: solo master (la creación de empresas es controlada)
CREATE POLICY "companies_insert_dual" ON public.companies
FOR INSERT WITH CHECK (
  public.is_master_dual()
);

-- 2. RLS Policies para DEPARTMENTS
-- Select: master o miembros de la empresa
CREATE POLICY "departments_select_dual" ON public.departments
FOR SELECT USING (
  public.is_master_dual() 
  OR public.is_member_of_company_dual(company_id)
);

-- Insert/Update/Delete: solo master o usuarios con alcance de empresa
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

-- 3. RLS Policies para MEMBERSHIPS
-- Select: master o miembros de la misma empresa
CREATE POLICY "memberships_select_dual" ON public.memberships
FOR SELECT USING (
  public.is_master_dual() 
  OR public.is_member_of_company_dual(company_id)
);

-- Insert/Update/Delete: solo master o usuarios con alcance de empresa
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

-- 4. RLS Policies para PROFILES_V2
-- Select: cada usuario ve solo su propio perfil, master ve todo
CREATE POLICY "profiles_v2_select_dual" ON public.profiles_v2
FOR SELECT USING (
  public.is_master_dual() 
  OR user_id = auth.uid()
);

-- Insert: cada usuario puede crear su propio perfil
CREATE POLICY "profiles_v2_insert_dual" ON public.profiles_v2
FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Update: cada usuario puede actualizar su propio perfil
CREATE POLICY "profiles_v2_update_dual" ON public.profiles_v2
FOR UPDATE USING (
  user_id = auth.uid()
);

-- 5. Habilitar RLS en todas las nuevas tablas (por si no estaba habilitado)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_v2 ENABLE ROW LEVEL SECURITY;

-- 6. Función helper adicional para verificar acceso dual (antiguo + nuevo)
CREATE OR REPLACE FUNCTION public.has_dual_access_to_company(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Chequear en el nuevo sistema
  SELECT (
    public.is_master_dual()
    OR public.is_member_of_company_dual(target_company_id)
    OR public.has_company_scope_dual(target_company_id)
    -- O en el sistema antiguo vía la cuenta migrada
    OR EXISTS (
      SELECT 1 FROM public.companies c
      INNER JOIN public.profiles p ON p.account_id = c.migrated_from_account_id
      WHERE c.id = target_company_id
        AND p.user_id = auth.uid()
    )
  );
$$;

COMMENT ON FUNCTION public.has_dual_access_to_company IS 'Verifica acceso a empresa en ambos sistemas (dual)';

-- 7. Vista de auditoría de permisos (útil para debugging)
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