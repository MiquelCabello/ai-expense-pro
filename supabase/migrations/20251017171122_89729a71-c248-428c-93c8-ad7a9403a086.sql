-- =====================================================
-- Limpieza del Sistema Antiguo - Paso 2: Eliminar Funciones y Tablas
-- =====================================================

-- 1. Eliminar funciones del sistema antiguo
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_account_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_account_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_account_plan(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_plan_limits(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.plan_settings(account_plan) CASCADE;
DROP FUNCTION IF EXISTS public.get_admin_count_for_account(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_user_role(uuid, uuid, user_role_type) CASCADE;
DROP FUNCTION IF EXISTS public.is_any_admin(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_department(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_legacy() CASCADE;

-- 2. Eliminar vistas del sistema antiguo
DROP VIEW IF EXISTS public.migration_status_v1 CASCADE;
DROP VIEW IF EXISTS public.migration_status_detailed CASCADE;
DROP VIEW IF EXISTS public.user_permissions_dual CASCADE;

-- 3. Eliminar tablas del sistema antiguo (en orden correcto por dependencias)
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.account_departments CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

-- 4. Eliminar tipos enum del sistema antiguo que ya no se usan
DROP TYPE IF EXISTS user_role_type CASCADE;
DROP TYPE IF EXISTS account_plan CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;

-- 5. Eliminar función de actualización antigua si existe
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- =====================================================
-- Sistema limpio: Solo quedan las tablas nuevas
-- =====================================================