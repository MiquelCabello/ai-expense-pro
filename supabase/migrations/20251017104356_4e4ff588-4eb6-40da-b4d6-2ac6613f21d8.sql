-- =========================================
-- FASE 2: FUNCIONES DE AUTORIZACIÓN DUALES
-- Funciones que pueden leer del nuevo O antiguo sistema
-- =========================================

-- 1. Función para obtener email (lee de ambos sistemas)
CREATE OR REPLACE FUNCTION public.get_user_email(target_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT email FROM public.profiles_v2 WHERE user_id = target_user_id),
    (SELECT email FROM auth.users WHERE id = target_user_id)
  );
$$;

COMMENT ON FUNCTION public.get_user_email IS 'Obtiene el email del usuario desde profiles_v2 o auth.users';

-- 2. Función maestra dual
CREATE OR REPLACE FUNCTION public.is_master_dual()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    LOWER(public.get_user_email(auth.uid())) = 'info@miquelcabello.com',
    FALSE
  );
$$;

COMMENT ON FUNCTION public.is_master_dual IS 'Verifica si el usuario actual es master (sistema dual)';

-- 3. Función de membership (nuevo sistema)
CREATE OR REPLACE FUNCTION public.is_member_of_company_dual(target_company UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = target_company 
      AND m.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_member_of_company_dual IS 'Verifica si el usuario es miembro de una empresa (sistema nuevo)';

-- 4. Función de alcance empresa (nuevo sistema)
CREATE OR REPLACE FUNCTION public.has_company_scope_dual(target_company UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = target_company
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'company_admin', 'global_admin')
  );
$$;

COMMENT ON FUNCTION public.has_company_scope_dual IS 'Verifica si el usuario tiene alcance de empresa completa';

-- 5. Función de alcance departamento (nuevo sistema)
CREATE OR REPLACE FUNCTION public.has_department_scope_dual(
  target_company UUID, 
  target_department UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = target_company
      AND m.user_id = auth.uid()
      AND m.role = 'department_admin'
      AND m.department_id = target_department
  );
$$;

COMMENT ON FUNCTION public.has_department_scope_dual IS 'Verifica si el usuario tiene alcance de departamento específico';

-- 6. Función para verificar si es empleado simple
CREATE OR REPLACE FUNCTION public.is_employee_dual(target_company UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = target_company
      AND m.user_id = auth.uid()
      AND m.role = 'employee'
  );
$$;

COMMENT ON FUNCTION public.is_employee_dual IS 'Verifica si el usuario es empleado simple en la empresa';

-- 7. Función para obtener el plan de una empresa (nuevo sistema)
CREATE OR REPLACE FUNCTION public.company_plan_dual(target_company UUID)
RETURNS plan_tier
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.plan FROM public.companies c WHERE c.id = target_company;
$$;

COMMENT ON FUNCTION public.company_plan_dual IS 'Obtiene el plan de una empresa';

-- 8. Función de límite de categorías efectivo (nuevo sistema)
CREATE OR REPLACE FUNCTION public.effective_category_limit_dual(target_company UUID)
RETURNS INT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.plan = 'pro' THEN COALESCE(c.category_limit, 4)
    WHEN c.plan = 'enterprise' THEN NULL
    ELSE NULL -- Free: sin límite explícito
  END
  FROM public.companies c
  WHERE c.id = target_company;
$$;

COMMENT ON FUNCTION public.effective_category_limit_dual IS 'Calcula el límite efectivo de categorías según el plan';

-- 9. Función legacy para mantener compatibilidad con sistema antiguo
CREATE OR REPLACE FUNCTION public.is_admin_legacy()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() 
      AND role = 'ADMIN'
  );
$$;

COMMENT ON FUNCTION public.is_admin_legacy IS 'Función legacy para verificar admin en sistema antiguo';

-- 10. Función para obtener company_id desde account_id (helper para migración)
CREATE OR REPLACE FUNCTION public.get_company_from_account(account_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.companies 
  WHERE migrated_from_account_id = account_uuid
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_company_from_account IS 'Obtiene company_id a partir de account_id (helper de migración)';

-- 11. Función para obtener el rol del usuario en una empresa (nuevo sistema)
CREATE OR REPLACE FUNCTION public.get_user_role_dual(
  target_user_id UUID,
  target_company UUID
)
RETURNS role_type
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role FROM public.memberships m
  WHERE m.user_id = target_user_id 
    AND m.company_id = target_company
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_role_dual IS 'Obtiene el rol de un usuario en una empresa específica';