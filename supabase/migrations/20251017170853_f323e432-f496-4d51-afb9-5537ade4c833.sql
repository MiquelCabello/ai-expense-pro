-- =====================================================
-- Limpieza del Sistema Antiguo - Paso 1: Eliminar Políticas RLS
-- =====================================================

-- Eliminar todas las políticas de la tabla profiles
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their scope" ON public.profiles;
DROP POLICY IF EXISTS "Master user can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Master user can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_account_members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

-- Eliminar todas las políticas de la tabla accounts
DROP POLICY IF EXISTS "Master user can manage all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Master user can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "accounts_select_owner" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update_owner" ON public.accounts;

-- Eliminar todas las políticas de la tabla account_departments
DROP POLICY IF EXISTS "Account owners and admins can manage departments" ON public.account_departments;
DROP POLICY IF EXISTS "Users can view departments in their account" ON public.account_departments;

-- Eliminar todas las políticas de la tabla user_roles
DROP POLICY IF EXISTS "Account admins can view all roles in their account" ON public.user_roles;
DROP POLICY IF EXISTS "Account owners can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Master user can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Eliminar todas las políticas de la tabla invitations
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can view invitations in their account" ON public.invitations;
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;

-- Eliminar todas las políticas de audit_logs relacionadas con el sistema antiguo
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "All authenticated users can create audit logs" ON public.audit_logs;