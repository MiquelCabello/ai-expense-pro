-- Corregir el trigger handle_new_user para respetar la lógica de roles
-- Usuario Master: info@miquelcabello.com (acceso total)
-- Usuarios Principales: registrados desde landing → ADMIN, sin account_id
-- Usuarios de Empresas: creados por principales → EMPLOYEE, con account_id

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role user_role;
  user_account_id uuid;
BEGIN
  -- Determinar el rol basado en la metadata
  -- Si viene con account_id en metadata, es un empleado (EMPLOYEE)
  -- Si NO viene con account_id, es un usuario principal (ADMIN)
  user_account_id := (NEW.raw_user_meta_data->>'account_id')::uuid;
  
  IF user_account_id IS NOT NULL THEN
    -- Usuario de empresa (empleado)
    user_role := 'EMPLOYEE'::user_role;
  ELSE
    -- Usuario principal (registrado desde landing)
    user_role := 'ADMIN'::user_role;
  END IF;

  -- Insertar el perfil con el rol correcto
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

  RETURN NEW;
END;
$$;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Comentario explicativo
COMMENT ON FUNCTION public.handle_new_user() IS 
'Crea perfiles automáticamente al registrar usuarios:
- Usuario Master: info@miquelcabello.com (identificado por is_master_user)
- Usuarios Principales: sin account_id en metadata → rol ADMIN
- Usuarios de Empresas: con account_id en metadata → rol EMPLOYEE';