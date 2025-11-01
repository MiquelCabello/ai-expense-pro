-- Paso 1: Eliminar TODOS los constraints que limitan department_id
ALTER TABLE public.memberships 
DROP CONSTRAINT IF EXISTS memberships_role_department_check;

ALTER TABLE public.memberships 
DROP CONSTRAINT IF EXISTS department_null_for_non_dept_admin;

-- Paso 2: Migrar datos existentes - asignar department_id a employees basándose en profiles
UPDATE public.memberships m
SET department_id = d.id,
    updated_at = now()
FROM public.profiles p,
     public.departments d
WHERE m.user_id = p.user_id
  AND d.company_id = m.company_id 
  AND d.name = p.department
  AND m.department_id IS NULL
  AND p.department IS NOT NULL
  AND m.role = 'employee'::role_type;

-- Paso 3: Actualizar el trigger handle_new_user para asignar department_id a todos los roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role user_role;
  user_account_id uuid;
  metadata_role text;
  user_department_id uuid;
BEGIN
  -- Determinar el rol basado en la metadata
  user_account_id := (NEW.raw_user_meta_data->>'account_id')::uuid;
  metadata_role := NEW.raw_user_meta_data->>'role';
  
  IF user_account_id IS NOT NULL THEN
    -- Usuario de empresa - usar el rol específico de los metadata si está disponible
    IF metadata_role = 'DEPARTMENT_ADMIN' THEN
      user_role := 'DEPARTMENT_ADMIN'::user_role;
    ELSIF metadata_role = 'ADMIN' THEN
      user_role := 'ADMIN'::user_role;
    ELSE
      user_role := 'EMPLOYEE'::user_role;
    END IF;
  ELSE
    -- Usuario principal (registrado desde landing)
    user_role := 'ADMIN'::user_role;
  END IF;

  -- Si tiene un department en metadata, buscar el department_id
  IF NEW.raw_user_meta_data->>'department' IS NOT NULL AND user_account_id IS NOT NULL THEN
    SELECT id INTO user_department_id
    FROM account_departments
    WHERE account_id = user_account_id
      AND name = NEW.raw_user_meta_data->>'department'
    LIMIT 1;
  END IF;

  -- Insertar el perfil en el sistema antiguo
  INSERT INTO public.profiles (
    user_id, 
    name, 
    role,
    account_id,
    department,
    region,
    department_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    user_role,
    user_account_id,
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'region',
    user_department_id
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
    DECLARE
      target_company_id uuid;
      target_department_id uuid;
      new_system_role role_type;
    BEGIN
      SELECT id INTO target_company_id
      FROM public.companies
      WHERE migrated_from_account_id = user_account_id
      LIMIT 1;

      -- Si existe la company migrada
      IF target_company_id IS NOT NULL THEN
        -- Mapear el rol al nuevo sistema
        new_system_role := CASE user_role
          WHEN 'ADMIN' THEN 'company_admin'::role_type
          WHEN 'DEPARTMENT_ADMIN' THEN 'department_admin'::role_type
          ELSE 'employee'::role_type
        END;

        -- NUEVO: Buscar department_id para TODOS los roles si tienen department en metadata
        IF NEW.raw_user_meta_data->>'department' IS NOT NULL THEN
          SELECT d.id INTO target_department_id
          FROM public.departments d
          WHERE d.company_id = target_company_id
            AND d.name = NEW.raw_user_meta_data->>'department'
          LIMIT 1;
        ELSE
          target_department_id := NULL;
        END IF;

        -- Crear membership en el nuevo sistema con department_id para todos los roles
        INSERT INTO public.memberships (
          user_id,
          company_id,
          role,
          department_id
        )
        VALUES (
          NEW.id,
          target_company_id,
          new_system_role,
          target_department_id
        )
        ON CONFLICT (user_id, company_id) DO NOTHING;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$function$;