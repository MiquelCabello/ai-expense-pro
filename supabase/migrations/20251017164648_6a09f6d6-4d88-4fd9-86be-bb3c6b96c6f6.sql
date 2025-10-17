-- ============================================
-- FASE 1 & 5: MIGRACIÓN COMPLETA DE BASE DE DATOS (CORREGIDO)
-- ============================================

-- 1. MIGRAR MEMBERSHIPS PENDIENTES
-- ============================================
INSERT INTO public.memberships (user_id, company_id, role, department_id, migrated_from_profile_id)
SELECT 
  p.user_id,
  c.id as company_id,
  CASE p.role
    WHEN 'ADMIN' THEN 'company_admin'::role_type
    WHEN 'DEPARTMENT_ADMIN' THEN 'department_admin'::role_type
    ELSE 'employee'::role_type
  END as role,
  d.id as department_id,
  p.id as migrated_from_profile_id
FROM public.profiles p
INNER JOIN public.companies c ON c.migrated_from_account_id = p.account_id
LEFT JOIN public.departments d ON d.company_id = c.id AND d.name = p.department
WHERE p.account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.user_id = p.user_id AND m.company_id = c.id
  )
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 2. MIGRAR DEPARTMENTS PENDIENTES (con ON CONFLICT)
-- ============================================
INSERT INTO public.departments (company_id, name, migrated_from_account_department_id)
SELECT 
  c.id as company_id,
  ad.name,
  ad.id as migrated_from_account_department_id
FROM public.account_departments ad
INNER JOIN public.companies c ON c.migrated_from_account_id = ad.account_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments d 
  WHERE d.company_id = c.id AND d.name = ad.name
)
ON CONFLICT (company_id, name) DO NOTHING;

-- 3. AGREGAR company_id A EXPENSES
-- ============================================
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS company_id UUID;

UPDATE public.expenses e
SET company_id = c.id
FROM public.companies c
WHERE c.migrated_from_account_id = e.account_id
  AND e.company_id IS NULL;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'expenses_company_id_fkey'
  ) THEN
    ALTER TABLE public.expenses
    ADD CONSTRAINT expenses_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id);
  END IF;
END $$;

-- 4. AGREGAR company_id A CATEGORIES
-- ============================================
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS company_id UUID;

UPDATE public.categories cat
SET company_id = c.id
FROM public.companies c
WHERE c.migrated_from_account_id = cat.account_id
  AND cat.company_id IS NULL;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'categories_company_id_fkey'
  ) THEN
    ALTER TABLE public.categories
    ADD CONSTRAINT categories_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id);
  END IF;
END $$;

-- 5. AGREGAR company_id A PROJECT_CODES
-- ============================================
ALTER TABLE public.project_codes ADD COLUMN IF NOT EXISTS company_id UUID;

UPDATE public.project_codes pc
SET company_id = c.id
FROM public.companies c
WHERE c.migrated_from_account_id = pc.account_id
  AND pc.company_id IS NULL;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_codes_company_id_fkey'
  ) THEN
    ALTER TABLE public.project_codes
    ADD CONSTRAINT project_codes_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id);
  END IF;
END $$;

-- 6. ACTUALIZAR RLS POLICIES PARA USAR company_id
-- ============================================

DROP POLICY IF EXISTS "expenses_select_company_members" ON public.expenses;
CREATE POLICY "expenses_select_company_members" 
ON public.expenses FOR SELECT 
USING (
  is_master_dual() 
  OR is_member_of_company_dual(company_id)
  OR has_company_scope_dual(company_id)
);

DROP POLICY IF EXISTS "categories_select_company_members" ON public.categories;
CREATE POLICY "categories_select_company_members" 
ON public.categories FOR SELECT 
USING (
  is_master_dual() 
  OR is_member_of_company_dual(company_id)
);

DROP POLICY IF EXISTS "categories_modify_company_admins" ON public.categories;
CREATE POLICY "categories_modify_company_admins" 
ON public.categories FOR ALL 
USING (
  is_master_dual() 
  OR has_company_scope_dual(company_id)
);

DROP POLICY IF EXISTS "project_codes_select_company_members" ON public.project_codes;
CREATE POLICY "project_codes_select_company_members" 
ON public.project_codes FOR SELECT 
USING (
  is_master_dual() 
  OR is_member_of_company_dual(company_id)
);

DROP POLICY IF EXISTS "project_codes_modify_company_admins" ON public.project_codes;
CREATE POLICY "project_codes_modify_company_admins" 
ON public.project_codes FOR ALL 
USING (
  is_master_dual() 
  OR has_company_scope_dual(company_id)
);

-- 7. ACTUALIZAR TRIGGER handle_new_user
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_account_id uuid;
  metadata_role text;
  target_company_id uuid;
  target_department_id uuid;
  new_system_role role_type;
BEGIN
  user_account_id := (NEW.raw_user_meta_data->>'account_id')::uuid;
  metadata_role := NEW.raw_user_meta_data->>'role';
  
  INSERT INTO public.profiles_v2 (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  IF user_account_id IS NOT NULL THEN
    SELECT id INTO target_company_id
    FROM public.companies
    WHERE migrated_from_account_id = user_account_id
    LIMIT 1;

    IF target_company_id IS NOT NULL THEN
      new_system_role := CASE metadata_role
        WHEN 'ADMIN' THEN 'company_admin'::role_type
        WHEN 'DEPARTMENT_ADMIN' THEN 'department_admin'::role_type
        ELSE 'employee'::role_type
      END;

      IF NEW.raw_user_meta_data->>'department' IS NOT NULL THEN
        SELECT d.id INTO target_department_id
        FROM public.departments d
        WHERE d.company_id = target_company_id
          AND d.name = NEW.raw_user_meta_data->>'department'
        LIMIT 1;
      ELSE
        target_department_id := NULL;
      END IF;

      INSERT INTO public.memberships (user_id, company_id, role, department_id)
      VALUES (NEW.id, target_company_id, new_system_role, target_department_id)
      ON CONFLICT (user_id, company_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;