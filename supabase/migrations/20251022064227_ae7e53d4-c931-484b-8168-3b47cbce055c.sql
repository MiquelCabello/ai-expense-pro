-- ============================================================================
-- MIGRACIÓN COMPLETA: Sistema de Roles, Accounts, RLS y Límites por Plan
-- Estrategia: columna temporal para migrar memberships.role
-- ============================================================================

-- Eliminar políticas de Storage que dependen de memberships.role
DROP POLICY IF EXISTS "Admins can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view company logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_company') THEN
    CREATE TYPE role_company AS ENUM ('owner','company_admin','department_admin','employee');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_role') THEN
    CREATE TYPE account_role AS ENUM ('account_owner');
  END IF;
END $$;

-- ============================================================================
-- TABLAS NUEVAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_memberships (
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role account_role NOT NULL DEFAULT 'account_owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.company_settings (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light',
  locale TEXT DEFAULT 'es-ES',
  currency TEXT DEFAULT 'EUR',
  extra JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- ACTUALIZAR TABLAS EXISTENTES
-- ============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS logo_file_id UUID REFERENCES public.files(id);

ALTER TABLE public.profiles_v2
  ADD COLUMN IF NOT EXISTS avatar_file_id UUID REFERENCES public.files(id);

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Migrar memberships.role usando columna temporal
DO $$ 
DECLARE
  col_type TEXT;
BEGIN
  -- Obtener el tipo actual de la columna role
  SELECT udt_name INTO col_type 
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='memberships' AND column_name='role';
  
  -- Solo migrar si NO es role_company
  IF col_type IS NOT NULL AND col_type <> 'role_company' THEN
    -- Paso 1: Añadir columna temporal
    ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS role_new role_company;
    
    -- Paso 2: Migrar datos
    UPDATE public.memberships SET role_new = (
      CASE role::text
        WHEN 'owner' THEN 'owner'::role_company
        WHEN 'company_admin' THEN 'company_admin'::role_company
        WHEN 'global_admin' THEN 'company_admin'::role_company
        WHEN 'department_admin' THEN 'department_admin'::role_company
        WHEN 'employee' THEN 'employee'::role_company
        ELSE 'employee'::role_company
      END
    );
    
    -- Paso 3: Eliminar columna antigua
    ALTER TABLE public.memberships DROP COLUMN role;
    
    -- Paso 4: Renombrar columna nueva
    ALTER TABLE public.memberships RENAME COLUMN role_new TO role;
  END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_memberships_company ON public.memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_memberships_department ON public.memberships(department_id);
CREATE INDEX IF NOT EXISTS idx_files_company ON public.files(company_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON public.files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_employee ON public.expenses(employee_id);

-- ============================================================================
-- FUNCIONES HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_safe_search_path() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('search_path', 'public', true);
$$;

CREATE OR REPLACE FUNCTION public.is_global_admin() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles_v2 p WHERE p.user_id = auth.uid() AND lower(p.email) = 'info@miquelcabello.com');
END;$$;

CREATE OR REPLACE FUNCTION public.is_account_owner(a_id UUID) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.account_memberships am WHERE am.account_id = a_id AND am.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(c_id UUID, roles TEXT[]) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.company_id = c_id AND m.user_id = auth.uid() AND m.role::text = ANY(roles));
$$;

CREATE OR REPLACE FUNCTION public.my_department_id(c_id UUID) RETURNS UUID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT m.department_id FROM public.memberships m WHERE m.company_id = c_id AND m.user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================================
-- ACTIVAR RLS
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ELIMINAR POLÍTICAS ANTIGUAS
-- ============================================================================

DROP POLICY IF EXISTS comp_read ON public.companies;
DROP POLICY IF EXISTS companies_insert_dual ON public.companies;
DROP POLICY IF EXISTS companies_update_dual ON public.companies;
DROP POLICY IF EXISTS dept_read ON public.departments;
DROP POLICY IF EXISTS departments_delete_dual ON public.departments;
DROP POLICY IF EXISTS departments_modify_dual ON public.departments;
DROP POLICY IF EXISTS departments_select_dual ON public.departments;
DROP POLICY IF EXISTS departments_update_dual ON public.departments;
DROP POLICY IF EXISTS memb_read ON public.memberships;
DROP POLICY IF EXISTS memberships_delete_dual ON public.memberships;
DROP POLICY IF EXISTS memberships_insert_dual ON public.memberships;
DROP POLICY IF EXISTS memberships_select_dual ON public.memberships;
DROP POLICY IF EXISTS memberships_update_dual ON public.memberships;
DROP POLICY IF EXISTS cat_read ON public.categories;
DROP POLICY IF EXISTS categories_modify ON public.categories;
DROP POLICY IF EXISTS categories_modify_company_admins ON public.categories;
DROP POLICY IF EXISTS categories_select ON public.categories;
DROP POLICY IF EXISTS categories_select_company_members ON public.categories;
DROP POLICY IF EXISTS pc_read ON public.project_codes;
DROP POLICY IF EXISTS project_codes_modify ON public.project_codes;
DROP POLICY IF EXISTS project_codes_modify_company_admins ON public.project_codes;
DROP POLICY IF EXISTS project_codes_select ON public.project_codes;
DROP POLICY IF EXISTS project_codes_select_company_members ON public.project_codes;
DROP POLICY IF EXISTS exp_read ON public.expenses;
DROP POLICY IF EXISTS exp_insert ON public.expenses;
DROP POLICY IF EXISTS exp_update_status_owner_company ON public.expenses;
DROP POLICY IF EXISTS exp_update_status_dept ON public.expenses;
DROP POLICY IF EXISTS exp_update_self_draft ON public.expenses;
DROP POLICY IF EXISTS "Company admins can update company expenses" ON public.expenses;
DROP POLICY IF EXISTS "Company admins can view all company expenses" ON public.expenses;
DROP POLICY IF EXISTS expenses_admin_all ON public.expenses;
DROP POLICY IF EXISTS expenses_employee_insert ON public.expenses;
DROP POLICY IF EXISTS expenses_employee_select ON public.expenses;
DROP POLICY IF EXISTS expenses_employee_update ON public.expenses;
DROP POLICY IF EXISTS expenses_select_company_members ON public.expenses;
DROP POLICY IF EXISTS files_read ON public.files;
DROP POLICY IF EXISTS files_insert ON public.files;
DROP POLICY IF EXISTS files_master_all ON public.files;
DROP POLICY IF EXISTS files_user_insert ON public.files;
DROP POLICY IF EXISTS files_user_select ON public.files;
DROP POLICY IF EXISTS "Master users can manage all files" ON public.files;
DROP POLICY IF EXISTS "Users can upload files" ON public.files;
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
DROP POLICY IF EXISTS receipts_read ON public.receipt_files;
DROP POLICY IF EXISTS rf_delete_own ON public.receipt_files;
DROP POLICY IF EXISTS rf_insert_own ON public.receipt_files;
DROP POLICY IF EXISTS rf_select_own ON public.receipt_files;
DROP POLICY IF EXISTS rf_update_own ON public.receipt_files;
DROP POLICY IF EXISTS audit_read ON public.audit_logs;
DROP POLICY IF EXISTS "All authenticated users can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Master users can manage all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;

-- ============================================================================
-- CREAR POLÍTICAS RLS NUEVAS
-- ============================================================================

CREATE POLICY acc_read ON public.accounts FOR SELECT USING (public.is_global_admin() OR public.is_account_owner(id));
CREATE POLICY acc_memb_read ON public.account_memberships FOR SELECT USING (public.is_global_admin() OR public.is_account_owner(account_id));
CREATE POLICY comp_read ON public.companies FOR SELECT USING (public.is_global_admin() OR (account_id IS NOT NULL AND public.is_account_owner(account_id)) OR public.has_company_role(id, ARRAY['owner','company_admin','department_admin','employee']));
CREATE POLICY comp_update ON public.companies FOR UPDATE USING (public.is_global_admin() OR public.has_company_role(id, ARRAY['owner','company_admin']));
CREATE POLICY comp_insert ON public.companies FOR INSERT WITH CHECK (public.is_global_admin());
CREATE POLICY comp_settings_read ON public.company_settings FOR SELECT USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin','department_admin','employee']));
CREATE POLICY comp_settings_write ON public.company_settings FOR ALL USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin']));
CREATE POLICY dept_read ON public.departments FOR SELECT USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin','department_admin']) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = departments.company_id AND c.account_id IS NOT NULL AND public.is_account_owner(c.account_id)));
CREATE POLICY dept_write ON public.departments FOR ALL USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin']));
CREATE POLICY memb_read ON public.memberships FOR SELECT USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin','department_admin']) OR (user_id = auth.uid()));
CREATE POLICY memb_write ON public.memberships FOR ALL USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin']));
CREATE POLICY cat_read ON public.categories FOR SELECT USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin','department_admin','employee']));
CREATE POLICY cat_write ON public.categories FOR ALL USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin']));
CREATE POLICY pc_read ON public.project_codes FOR SELECT USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin','department_admin','employee']));
CREATE POLICY pc_write ON public.project_codes FOR ALL USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin']));
CREATE POLICY exp_read ON public.expenses FOR SELECT USING (public.is_global_admin() OR public.has_company_role(company_id, ARRAY['owner','company_admin']) OR (public.has_company_role(company_id, ARRAY['department_admin']) AND employee_id IN (SELECT m.user_id FROM public.memberships m WHERE m.company_id = expenses.company_id AND m.department_id = public.my_department_id(expenses.company_id))) OR (employee_id = auth.uid()));
CREATE POLICY exp_insert ON public.expenses FOR INSERT WITH CHECK (public.has_company_role(company_id, ARRAY['employee','department_admin','company_admin','owner']) AND employee_id = auth.uid());
CREATE POLICY exp_update_owner_company ON public.expenses FOR UPDATE USING (public.has_company_role(company_id, ARRAY['owner','company_admin']));
CREATE POLICY exp_update_dept ON public.expenses FOR UPDATE USING (public.has_company_role(company_id, ARRAY['department_admin']) AND (employee_id IN (SELECT m.user_id FROM public.memberships m WHERE m.company_id = expenses.company_id AND m.department_id = public.my_department_id(expenses.company_id)) OR employee_id = auth.uid()));
CREATE POLICY exp_update_self_draft ON public.expenses FOR UPDATE USING (employee_id = auth.uid() AND status = 'PENDING');
CREATE POLICY files_read ON public.files FOR SELECT USING (public.is_global_admin() OR uploaded_by = auth.uid() OR (company_id IS NOT NULL AND public.has_company_role(company_id, ARRAY['owner','company_admin','department_admin','employee'])));
CREATE POLICY files_insert ON public.files FOR INSERT WITH CHECK (uploaded_by = auth.uid() AND (company_id IS NULL OR public.has_company_role(company_id, ARRAY['owner','company_admin','department_admin','employee'])));
CREATE POLICY receipts_read ON public.receipt_files FOR SELECT USING (public.is_global_admin() OR user_id = auth.uid());
CREATE POLICY receipts_write ON public.receipt_files FOR ALL USING (user_id = auth.uid());
CREATE POLICY audit_read ON public.audit_logs FOR SELECT USING (public.is_global_admin() OR actor_user_id = auth.uid());
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT WITH CHECK (actor_user_id = auth.uid());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assert_enterprise_for_departments() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_plan plan_tier; BEGIN SELECT c.plan INTO v_plan FROM public.companies c WHERE c.id = NEW.company_id;
IF v_plan <> 'enterprise' THEN RAISE EXCEPTION 'Solo el plan Enterprise puede crear departamentos'; END IF; RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_departments_plan ON public.departments;
CREATE TRIGGER trg_departments_plan BEFORE INSERT ON public.departments FOR EACH ROW EXECUTE FUNCTION public.assert_enterprise_for_departments();

CREATE OR REPLACE FUNCTION public.assert_category_quota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_plan plan_tier; v_count INT; v_limit INT; BEGIN SELECT c.plan INTO v_plan FROM public.companies c WHERE c.id = NEW.company_id;
IF v_plan = 'enterprise' THEN RETURN NEW; END IF; v_limit := CASE WHEN v_plan = 'pro' THEN 4 ELSE 2 END;
SELECT COUNT(*) INTO v_count FROM public.categories WHERE company_id = NEW.company_id;
IF v_count >= v_limit THEN RAISE EXCEPTION 'Límite de categorías alcanzado para el plan % (máximo: %)', v_plan, v_limit; END IF; RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_categories_quota ON public.categories;
CREATE TRIGGER trg_categories_quota BEFORE INSERT ON public.categories FOR EACH ROW EXECUTE FUNCTION public.assert_category_quota();

CREATE OR REPLACE FUNCTION public.assert_monthly_expense_quota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_plan plan_tier; v_count INT; BEGIN SELECT c.plan INTO v_plan FROM public.companies c WHERE c.id = NEW.company_id;
IF v_plan <> 'free' THEN RETURN NEW; END IF;
SELECT COUNT(*) INTO v_count FROM public.expenses e WHERE e.company_id = NEW.company_id AND date_trunc('month', e.expense_date) = date_trunc('month', NEW.expense_date);
IF v_count >= 40 THEN RAISE EXCEPTION 'Límite mensual de 40 gastos alcanzado en plan Free'; END IF; RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_expenses_quota ON public.expenses;
CREATE TRIGGER trg_expenses_quota BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.assert_monthly_expense_quota();

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER trg_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();