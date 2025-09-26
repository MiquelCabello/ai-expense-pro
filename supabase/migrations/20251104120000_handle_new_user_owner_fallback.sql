-- Ensure invited users reuse the inviter's account when metadata is missing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_plan public.account_plan;
  v_role public.user_role;
  v_name TEXT;
  v_department TEXT;
  v_region TEXT;
  v_existing_count INTEGER;
  v_account public.accounts%ROWTYPE;
  v_settings RECORD;
  v_account_owner UUID;
BEGIN
  v_account_id := NULL;
  v_role := 'EMPLOYEE'::public.user_role;
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
  v_department := NEW.raw_user_meta_data->>'department';
  v_region := NEW.raw_user_meta_data->>'region';

  IF NEW.raw_user_meta_data ? 'account_id' THEN
    v_account_id := (NEW.raw_user_meta_data->>'account_id')::UUID;
  END IF;

  IF v_account_id IS NULL AND NEW.raw_user_meta_data ? 'account_owner_id' THEN
    v_account_owner := (NEW.raw_user_meta_data->>'account_owner_id')::UUID;
    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE owner_user_id = v_account_owner
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_account_id IS NULL THEN
    v_plan := COALESCE((NEW.raw_user_meta_data->>'plan')::public.account_plan, 'FREE');
    SELECT * INTO v_settings FROM public.plan_settings(v_plan);

    INSERT INTO public.accounts (
      owner_user_id,
      name,
      plan,
      max_employees,
      can_assign_roles,
      can_assign_department,
      can_assign_region,
      can_add_custom_categories,
      monthly_expense_limit
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', v_name),
      v_plan,
      v_settings.max_employees,
      v_settings.can_assign_roles,
      v_settings.can_assign_department,
      v_settings.can_assign_region,
      v_settings.can_add_custom_categories,
      v_settings.monthly_expense_limit
    )
    ON CONFLICT (owner_user_id) DO UPDATE
    SET
      plan = EXCLUDED.plan,
      max_employees = EXCLUDED.max_employees,
      can_assign_roles = EXCLUDED.can_assign_roles,
      can_assign_department = EXCLUDED.can_assign_department,
      can_assign_region = EXCLUDED.can_assign_region,
      can_add_custom_categories = EXCLUDED.can_add_custom_categories,
      monthly_expense_limit = EXCLUDED.monthly_expense_limit
    RETURNING id INTO v_account_id;

    PERFORM public.seed_account_defaults(v_account_id);

    v_role := 'ADMIN'::public.user_role;
    v_department := NULL;
    v_region := NULL;
  ELSE
    SELECT * INTO v_account FROM public.accounts WHERE id = v_account_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found', v_account_id;
    END IF;

    v_plan := v_account.plan;
    SELECT * INTO v_settings FROM public.plan_settings(v_plan);

    IF v_settings.max_employees IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_count
      FROM public.profiles
      WHERE account_id = v_account_id
        AND status = 'ACTIVE';
      IF v_existing_count >= v_settings.max_employees THEN
        RAISE EXCEPTION 'EMPLOYEE_LIMIT_REACHED';
      END IF;
    END IF;

    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'EMPLOYEE'::public.user_role);
    IF NOT v_settings.can_assign_roles AND NEW.id <> v_account.owner_user_id THEN
      v_role := 'EMPLOYEE'::public.user_role;
    END IF;

    IF NOT v_settings.can_assign_department THEN
      v_department := NULL;
    END IF;
    IF NOT v_settings.can_assign_region THEN
      v_region := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, name, role, department, region, account_id)
  VALUES (
    NEW.id,
    v_name,
    v_role,
    v_department,
    v_region,
    v_account_id
  );

  RETURN NEW;
END;
$$;
