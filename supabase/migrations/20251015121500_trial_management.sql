-- Trial management support: account lifecycle and downgrade helper

-- 1. Ensure account_status enum exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'account_status'
  ) THEN
    CREATE TYPE public.account_status AS ENUM ('ACTIVE', 'TRIALING', 'SUSPENDED');
  END IF;
END;
$$;

-- 2. Extend accounts table with trial metadata
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status public.account_status NOT NULL DEFAULT 'ACTIVE';

-- 3. Index to speed up cron lookups for expired trials
CREATE INDEX IF NOT EXISTS accounts_trial_expires_at_idx
  ON public.accounts (trial_expires_at)
  WHERE status = 'TRIALING';

-- 4. Downgrade helper that enforces Free plan limits and returns a cleanup summary
CREATE OR REPLACE FUNCTION public.downgrade_trial_account(_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_owner UUID;
  v_removed_expenses INTEGER := 0;
  v_removed_files INTEGER := 0;
  v_removed_logs INTEGER := 0;
  v_removed_categories INTEGER := 0;
  v_removed_projects INTEGER := 0;
  v_inactivated_profiles INTEGER := 0;
BEGIN
  SELECT owner_user_id
  INTO v_owner
  FROM public.accounts
  WHERE id = _account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT *
  INTO v_settings
  FROM public.plan_settings('FREE');

  -- Remove expenses first to release FK references to categories/files
  DELETE FROM public.expenses
  WHERE account_id = _account_id;
  GET DIAGNOSTICS v_removed_expenses = ROW_COUNT;

  DELETE FROM public.audit_logs
  WHERE account_id = _account_id;
  GET DIAGNOSTICS v_removed_logs = ROW_COUNT;

  DELETE FROM public.files
  WHERE account_id = _account_id;
  GET DIAGNOSTICS v_removed_files = ROW_COUNT;

  DELETE FROM public.project_codes
  WHERE account_id = _account_id;
  GET DIAGNOSTICS v_removed_projects = ROW_COUNT;

  DELETE FROM public.categories
  WHERE account_id = _account_id;
  GET DIAGNOSTICS v_removed_categories = ROW_COUNT;

  PERFORM public.seed_account_defaults(_account_id);

  WITH ranked_profiles AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        ORDER BY (user_id = v_owner) DESC, created_at ASC
      ) AS rn
    FROM public.profiles
    WHERE account_id = _account_id
      AND status = 'ACTIVE'
  )
  UPDATE public.profiles p
  SET status = 'INACTIVE'
  FROM ranked_profiles rp
  WHERE p.id = rp.id
    AND rp.rn > COALESCE(v_settings.max_employees, 0);
  GET DIAGNOSTICS v_inactivated_profiles = ROW_COUNT;

  UPDATE public.accounts
  SET
    plan = 'FREE',
    max_employees = v_settings.max_employees,
    can_assign_roles = v_settings.can_assign_roles,
    can_assign_department = v_settings.can_assign_department,
    can_assign_region = v_settings.can_assign_region,
    can_add_custom_categories = v_settings.can_add_custom_categories,
    monthly_expense_limit = v_settings.monthly_expense_limit,
    status = 'ACTIVE',
    trial_started_at = NULL,
    trial_expires_at = NULL
  WHERE id = _account_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'removed_expenses', v_removed_expenses,
    'removed_audit_logs', v_removed_logs,
    'removed_files', v_removed_files,
    'removed_categories', v_removed_categories,
    'removed_project_codes', v_removed_projects,
    'inactivated_profiles', v_inactivated_profiles
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.downgrade_trial_account(UUID) TO service_role;

-- 5. Update handle_new_user to seed trial metadata for Professional signups
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
  v_trial_started_at TIMESTAMPTZ;
  v_trial_expires_at TIMESTAMPTZ;
  v_status public.account_status;
BEGIN
  v_account_id := NULL;
  v_role := 'EMPLOYEE'::public.user_role;
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
  v_department := NEW.raw_user_meta_data->>'department';
  v_region := NEW.raw_user_meta_data->>'region';
  v_trial_started_at := NULL;
  v_trial_expires_at := NULL;
  v_status := 'ACTIVE'::public.account_status;

  IF NEW.raw_user_meta_data ? 'account_id' THEN
    v_account_id := (NEW.raw_user_meta_data->>'account_id')::UUID;
  END IF;

  IF v_account_id IS NULL THEN
    v_plan := COALESCE((NEW.raw_user_meta_data->>'plan')::public.account_plan, 'FREE');
    SELECT * INTO v_settings FROM public.plan_settings(v_plan);

    IF v_plan = 'PROFESSIONAL'::public.account_plan THEN
      v_trial_started_at := timezone('utc', now());
      v_trial_expires_at := v_trial_started_at + INTERVAL '30 days';
      v_status := 'TRIALING'::public.account_status;
    END IF;

    INSERT INTO public.accounts (
      owner_user_id,
      name,
      plan,
      max_employees,
      can_assign_roles,
      can_assign_department,
      can_assign_region,
      can_add_custom_categories,
      monthly_expense_limit,
      trial_started_at,
      trial_expires_at,
      status
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
      v_settings.monthly_expense_limit,
      v_trial_started_at,
      v_trial_expires_at,
      v_status
    )
    ON CONFLICT (owner_user_id) DO UPDATE
    SET
      plan = EXCLUDED.plan,
      max_employees = EXCLUDED.max_employees,
      can_assign_roles = EXCLUDED.can_assign_roles,
      can_assign_department = EXCLUDED.can_assign_department,
      can_assign_region = EXCLUDED.can_assign_region,
      can_add_custom_categories = EXCLUDED.can_add_custom_categories,
      monthly_expense_limit = EXCLUDED.monthly_expense_limit,
      trial_started_at = COALESCE(public.accounts.trial_started_at, EXCLUDED.trial_started_at),
      trial_expires_at = COALESCE(public.accounts.trial_expires_at, EXCLUDED.trial_expires_at),
      status = CASE
        WHEN public.accounts.status = 'TRIALING'::public.account_status THEN public.accounts.status
        ELSE EXCLUDED.status
      END
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

    v_status := v_account.status;
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
