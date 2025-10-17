-- =====================================================
-- Paso 3: Crear políticas RLS para el nuevo sistema
-- =====================================================

-- POLÍTICAS PARA EXPENSES
-- Los empleados pueden ver y crear sus propios gastos
CREATE POLICY "expenses_employee_select"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  public.is_master_dual()
  OR auth.uid() = employee_id
  OR public.has_company_scope_dual(company_id)
  OR public.is_member_of_company_dual(company_id)
);

CREATE POLICY "expenses_employee_insert"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "expenses_employee_update"
ON public.expenses
FOR UPDATE
TO authenticated
USING (
  auth.uid() = employee_id 
  AND status = 'PENDING'::expense_status
);

-- Los admins pueden gestionar todos los gastos de su empresa
CREATE POLICY "expenses_admin_all"
ON public.expenses
FOR ALL
TO authenticated
USING (
  public.is_master_dual()
  OR public.has_company_scope_dual(company_id)
);

-- POLÍTICAS PARA CATEGORIES
-- Todos pueden ver las categorías de su empresa
CREATE POLICY "categories_select"
ON public.categories
FOR SELECT
TO authenticated
USING (
  public.is_master_dual()
  OR public.is_member_of_company_dual(company_id)
);

-- Solo admins pueden gestionar categorías
CREATE POLICY "categories_modify"
ON public.categories
FOR ALL
TO authenticated
USING (
  public.is_master_dual()
  OR public.has_company_scope_dual(company_id)
);

-- POLÍTICAS PARA PROJECT_CODES
-- Todos pueden ver los códigos de proyecto de su empresa
CREATE POLICY "project_codes_select"
ON public.project_codes
FOR SELECT
TO authenticated
USING (
  public.is_master_dual()
  OR public.is_member_of_company_dual(company_id)
);

-- Solo admins pueden gestionar códigos de proyecto
CREATE POLICY "project_codes_modify"
ON public.project_codes
FOR ALL
TO authenticated
USING (
  public.is_master_dual()
  OR public.has_company_scope_dual(company_id)
);

-- POLÍTICAS PARA FILES
-- Los usuarios pueden ver y subir sus propios archivos
CREATE POLICY "files_user_select"
ON public.files
FOR SELECT
TO authenticated
USING (auth.uid() = uploaded_by);

CREATE POLICY "files_user_insert"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

-- Los admins master pueden ver todos los archivos
CREATE POLICY "files_master_all"
ON public.files
FOR ALL
TO authenticated
USING (public.is_master_dual());

-- Corregir search_path en funciones existentes
ALTER FUNCTION public.get_company_from_account(uuid) SET search_path = public;
ALTER FUNCTION public.get_user_role_dual(uuid, uuid) SET search_path = public;