-- =====================================================
-- Paso 1: Eliminar políticas RLS del sistema antiguo
-- =====================================================

-- Eliminar políticas de expenses que usan funciones antiguas
DROP POLICY IF EXISTS "Admins can view expenses in their scope" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update expenses in their scope" ON public.expenses;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their scope" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_account_members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "Master user can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Master user can view all profiles" ON public.profiles;

-- Eliminar políticas de categories que referencian el sistema antiguo
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "All authenticated users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Master user can manage all categories" ON public.categories;
DROP POLICY IF EXISTS "Master user can view all categories" ON public.categories;
DROP POLICY IF EXISTS "categories_select_account_members" ON public.categories;

-- Eliminar políticas de project_codes
DROP POLICY IF EXISTS "Admins can manage project codes" ON public.project_codes;
DROP POLICY IF EXISTS "All authenticated users can view project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Master user can manage all project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Master user can view all project codes" ON public.project_codes;

-- Eliminar políticas de files
DROP POLICY IF EXISTS "Admins can view all files" ON public.files;
DROP POLICY IF EXISTS "Master user can manage all files" ON public.files;
DROP POLICY IF EXISTS "Master user can view all files" ON public.files;
DROP POLICY IF EXISTS "Users can upload files" ON public.files;
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;

-- Eliminar políticas de expenses relacionadas con sistema antiguo
DROP POLICY IF EXISTS "Employees can create their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can update their own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Master user can manage all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Master user can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "exp_delete_own" ON public.expenses;
DROP POLICY IF EXISTS "exp_insert_own" ON public.expenses;
DROP POLICY IF EXISTS "exp_select_own" ON public.expenses;
DROP POLICY IF EXISTS "exp_update_own" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_account_members" ON public.expenses;

-- Eliminar políticas de account_departments
DROP POLICY IF EXISTS "Account owners and admins can manage departments" ON public.account_departments;
DROP POLICY IF EXISTS "Users can view departments in their account" ON public.account_departments;

-- Eliminar políticas de accounts
DROP POLICY IF EXISTS "Master user can manage all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Master user can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "accounts_select_owner" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update_owner" ON public.accounts;

-- Eliminar políticas de invitations
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can view invitations in their account" ON public.invitations;
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;

-- Eliminar políticas de user_roles
DROP POLICY IF EXISTS "Account admins can view all roles in their account" ON public.user_roles;
DROP POLICY IF EXISTS "Account owners can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Master user can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Eliminar políticas de audit_logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "All authenticated users can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Master user can manage all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Master user can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;