-- Actualizar trigger handle_new_user para incluir country, city y name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_account_id uuid;
  metadata_role text;
  target_company_id uuid;
  target_department_id uuid;
  new_system_role role_type;
  user_name text;
  user_country text;
  user_city text;
BEGIN
  user_account_id := (NEW.raw_user_meta_data->>'account_id')::uuid;
  metadata_role := NEW.raw_user_meta_data->>'role';
  user_name := NEW.raw_user_meta_data->>'name';
  user_country := NEW.raw_user_meta_data->>'country';
  user_city := NEW.raw_user_meta_data->>'city';
  
  INSERT INTO public.profiles_v2 (user_id, email, name, country, city)
  VALUES (NEW.id, NEW.email, user_name, user_country, user_city)
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, profiles_v2.name),
        country = COALESCE(EXCLUDED.country, profiles_v2.country),
        city = COALESCE(EXCLUDED.city, profiles_v2.city),
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