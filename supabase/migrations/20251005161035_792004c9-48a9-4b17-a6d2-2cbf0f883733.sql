-- ============================================
-- MIGRACIÓN: Sistema de roles y usuarios mejorado
-- ============================================

-- 1. Crear enum para roles más específico
CREATE TYPE public.user_role_type AS ENUM (
  'account_owner',      -- Propietario de la cuenta (usuario principal)
  'account_admin',      -- Admin global de la cuenta (máx 2 en Professional/Enterprise)
  'department_admin',   -- Admin de departamento (solo Enterprise)
  'employee'            -- Empleado estándar
);

-- 2. Crear tabla de roles separada (CRÍTICO para seguridad)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role user_role_type NOT NULL,
  department_id UUID REFERENCES public.account_departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, account_id, role, department_id)
);

-- 3. Habilitar RLS en user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Crear función de seguridad para verificar roles (SECURITY DEFINER evita recursión)
CREATE OR REPLACE FUNCTION public.check_user_role(
  _user_id UUID,
  _account_id UUID,
  _role user_role_type
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND account_id = _account_id
      AND role = _role
  );
$$;

-- 5. Función para verificar si es admin (global o departamental)
CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id UUID, _account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND account_id = _account_id
      AND role IN ('account_owner', 'account_admin', 'department_admin')
  );
$$;

-- 6. Función para obtener departamento del admin
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID, _account_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND account_id = _account_id
    AND role = 'department_admin'
  LIMIT 1;
$$;

-- 7. Políticas RLS para user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Account owners can manage roles"
  ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = user_roles.account_id
        AND accounts.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Account admins can view all roles in their account"
  ON public.user_roles
  FOR SELECT
  USING (
    check_user_role(auth.uid(), account_id, 'account_admin')
    OR check_user_role(auth.uid(), account_id, 'account_owner')
  );

CREATE POLICY "Master user can manage all roles"
  ON public.user_roles
  FOR ALL
  USING (is_master_user(auth.uid()));

-- 8. Migrar datos existentes de profiles a user_roles
INSERT INTO public.user_roles (user_id, account_id, role, created_at)
SELECT 
  p.user_id,
  p.account_id,
  CASE 
    WHEN a.owner_user_id = p.user_id THEN 'account_owner'::user_role_type
    WHEN p.role = 'ADMIN' THEN 'account_admin'::user_role_type
    ELSE 'employee'::user_role_type
  END,
  p.created_at
FROM public.profiles p
JOIN public.accounts a ON p.account_id = a.id
WHERE p.account_id IS NOT NULL
ON CONFLICT (user_id, account_id, role, department_id) DO NOTHING;

-- 9. Actualizar políticas RLS de expenses para usar roles
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update all expenses" ON public.expenses;

CREATE POLICY "Admins can view expenses in their scope"
  ON public.expenses
  FOR SELECT
  USING (
    -- Usuario master
    is_master_user(auth.uid())
    OR
    -- Propietario o admin global
    is_any_admin(auth.uid(), account_id)
    OR
    -- Employee viendo sus propios gastos
    auth.uid() = user_id
    OR
    -- Admin departamental viendo gastos de su departamento
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.user_id = expenses.employee_id
        AND p.department_id = get_user_department(auth.uid(), expenses.account_id)
    )
  );

CREATE POLICY "Admins can update expenses in their scope"
  ON public.expenses
  FOR UPDATE
  USING (
    is_master_user(auth.uid())
    OR
    is_any_admin(auth.uid(), account_id)
    OR
    (auth.uid() = user_id AND status = 'PENDING')
  );

-- 10. Actualizar políticas RLS de profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view profiles in their scope"
  ON public.profiles
  FOR SELECT
  USING (
    is_master_user(auth.uid())
    OR
    auth.uid() = user_id
    OR
    is_any_admin(auth.uid(), account_id)
  );

-- 11. Trigger para actualizar updated_at en user_roles
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Añadir índices para mejor performance
CREATE INDEX idx_user_roles_user_account ON public.user_roles(user_id, account_id);
CREATE INDEX idx_user_roles_account_role ON public.user_roles(account_id, role);
CREATE INDEX idx_profiles_account_dept ON public.profiles(account_id, department_id);

-- 13. Comentarios para documentación
COMMENT ON TABLE public.user_roles IS 'Tabla de roles de usuarios - separada para seguridad. Roles: account_owner (propietario), account_admin (admin global, máx 2), department_admin (admin dept, solo Enterprise), employee';
COMMENT ON COLUMN public.user_roles.department_id IS 'Solo para department_admin - indica qué departamento administra';
COMMENT ON FUNCTION public.check_user_role IS 'Función SECURITY DEFINER para verificar roles sin recursión RLS';
