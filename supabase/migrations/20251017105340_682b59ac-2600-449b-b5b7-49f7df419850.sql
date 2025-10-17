-- =========================================
-- FASE 5B: Actualizar trigger para dual write
-- =========================================

-- Actualizar el trigger handle_new_user para que también escriba en profiles_v2
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_role user_role;
  user_account_id uuid;
BEGIN
  -- Determinar el rol basado en la metadata
  user_account_id := (NEW.raw_user_meta_data->>'account_id')::uuid;
  
  IF user_account_id IS NOT NULL THEN
    -- Usuario de empresa (empleado)
    user_role := 'EMPLOYEE'::user_role;
  ELSE
    -- Usuario principal (registrado desde landing)
    user_role := 'ADMIN'::user_role;
  END IF;

  -- Insertar el perfil en el sistema antiguo
  INSERT INTO public.profiles (
    user_id, 
    name, 
    role,
    account_id,
    department,
    region
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    user_role,
    user_account_id,
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'region'
  );

  -- === DUAL WRITE: Insertar en profiles_v2 (nuevo sistema) ===
  INSERT INTO public.profiles_v2 (
    user_id,
    email
  )
  VALUES (
    NEW.id,
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  -- === DUAL WRITE: Si tiene account_id, crear membership en el nuevo sistema ===
  IF user_account_id IS NOT NULL THEN
    -- Buscar la company migrada desde este account
    DECLARE
      target_company_id uuid;
      target_department_id uuid;
    BEGIN
      SELECT id INTO target_company_id
      FROM public.companies
      WHERE migrated_from_account_id = user_account_id
      LIMIT 1;

      -- Si existe la company migrada
      IF target_company_id IS NOT NULL THEN
        -- Buscar department si existe
        IF NEW.raw_user_meta_data->>'department' IS NOT NULL THEN
          SELECT d.id INTO target_department_id
          FROM public.departments d
          WHERE d.company_id = target_company_id
            AND d.name = NEW.raw_user_meta_data->>'department'
          LIMIT 1;
        END IF;

        -- Crear membership en el nuevo sistema
        INSERT INTO public.memberships (
          user_id,
          company_id,
          role,
          department_id
        )
        VALUES (
          NEW.id,
          target_company_id,
          CASE user_role
            WHEN 'ADMIN' THEN 'company_admin'::role_type
            ELSE 'employee'::role_type
          END,
          target_department_id
        )
        ON CONFLICT (user_id, company_id) DO NOTHING;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user IS 'Trigger function para crear perfiles en ambos sistemas (dual write) cuando se crea un usuario';