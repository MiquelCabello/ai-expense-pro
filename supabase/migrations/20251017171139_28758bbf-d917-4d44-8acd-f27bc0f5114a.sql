-- =====================================================
-- Actualizar Políticas RLS de expenses al Nuevo Sistema
-- =====================================================

-- Eliminar políticas antiguas que usan funciones obsoletas
DROP POLICY IF EXISTS "Admins can update expenses in their scope" ON public.expenses;
DROP POLICY IF EXISTS "Admins can view expenses in their scope" ON public.expenses;

-- Crear nuevas políticas usando el sistema dual
-- Admins (company_admin, global_admin, owner) pueden ver todos los gastos de su empresa
CREATE POLICY "Company admins can view all company expenses" 
ON public.expenses 
FOR SELECT 
USING (
  is_master_dual() 
  OR has_company_scope_dual(company_id)
  OR (auth.uid() = employee_id)
);

-- Admins pueden actualizar gastos de su empresa
CREATE POLICY "Company admins can update company expenses" 
ON public.expenses 
FOR UPDATE 
USING (
  is_master_dual() 
  OR has_company_scope_dual(company_id)
  OR ((auth.uid() = employee_id) AND (status = 'PENDING'::expense_status))
);

-- =====================================================
-- Ahora eliminar todo el sistema antiguo
-- =====================================================

-- 1. Eliminar vistas
DROP VIEW IF EXISTS public.migration_status_v1 CASCADE;
DROP VIEW IF EXISTS public.migration_status_detailed CASCADE;
DROP VIEW IF EXISTS public.user_permissions_dual CASCADE;

-- 2. Eliminar tablas con CASCADE
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.account_departments CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

-- 3. Eliminar funciones del sistema antiguo
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.is_account_admin(uuid);
DROP FUNCTION IF EXISTS public.get_account_id(uuid);
DROP FUNCTION IF EXISTS public.get_account_plan(uuid);
DROP FUNCTION IF EXISTS public.check_plan_limits(uuid, text);
DROP FUNCTION IF EXISTS public.plan_settings(account_plan);
DROP FUNCTION IF EXISTS public.get_admin_count_for_account(uuid);
DROP FUNCTION IF EXISTS public.check_user_role(uuid, uuid, user_role_type);
DROP FUNCTION IF EXISTS public.is_any_admin(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_user_department(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_admin_legacy();

-- 4. Eliminar tipos enum antiguos
DROP TYPE IF EXISTS user_role_type CASCADE;
DROP TYPE IF EXISTS account_plan CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;

-- 5. Eliminar función de actualización antigua
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- =====================================================
-- ✅ Sistema completamente limpio
-- =====================================================