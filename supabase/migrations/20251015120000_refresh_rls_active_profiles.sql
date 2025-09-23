-- Ensure multi-tenant policies use the active-profile aware helper
BEGIN;

-- Remove policies created by 20250930120000_fix_rls_policy_warnings.sql
DROP POLICY IF EXISTS "profiles_select_account_members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;

DROP POLICY IF EXISTS "categories_select_account_members" ON public.categories;
DROP POLICY IF EXISTS "categories_write_admin_only" ON public.categories;

DROP POLICY IF EXISTS "project_codes_select_account_members" ON public.project_codes;
DROP POLICY IF EXISTS "project_codes_write_admin_only" ON public.project_codes;

DROP POLICY IF EXISTS "files_select_account_members" ON public.files;
DROP POLICY IF EXISTS "files_insert_same_account" ON public.files;
DROP POLICY IF EXISTS "files_update_owner_or_admin" ON public.files;
DROP POLICY IF EXISTS "files_delete_admin_only" ON public.files;

DROP POLICY IF EXISTS "expenses_select_account_members" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_same_account" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_owner_or_admin" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_admin_only" ON public.expenses;

DROP POLICY IF EXISTS "audit_logs_select_account_members" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_same_account" ON public.audit_logs;

-- Drop legacy helper-based policies so we can recreate them with consistent rules
DROP POLICY IF EXISTS "Account users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage account profiles" ON public.profiles;

DROP POLICY IF EXISTS "Account users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories when allowed" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;

DROP POLICY IF EXISTS "Account users can view project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Admins manage project codes" ON public.project_codes;

DROP POLICY IF EXISTS "Account users can view files" ON public.files;
DROP POLICY IF EXISTS "Users upload files within account" ON public.files;
DROP POLICY IF EXISTS "Users update their files" ON public.files;
DROP POLICY IF EXISTS "Admins manage account files" ON public.files;

DROP POLICY IF EXISTS "Employees view their expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees update own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins view account expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins manage account expenses" ON public.expenses;

DROP POLICY IF EXISTS "Account users view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Account users insert audit logs" ON public.audit_logs;

-- Profiles
CREATE POLICY "Account users can view profiles"
  ON public.profiles
  FOR SELECT
  USING (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

CREATE POLICY "Users can update their profile"
  ON public.profiles
  FOR UPDATE
  USING (
    (user_id = auth.uid() AND account_id = public.get_account_id(auth.uid()))
    OR public.is_master_user()
  )
  WITH CHECK (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

CREATE POLICY "Admins manage account profiles"
  ON public.profiles
  FOR ALL
  USING (
    (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  )
  WITH CHECK (
    (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  );

-- Categories
CREATE POLICY "Account users can view categories"
  ON public.categories
  FOR SELECT
  USING (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

CREATE POLICY "Admins can update categories"
  ON public.categories
  FOR UPDATE
  USING (
    (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  )
  WITH CHECK (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

CREATE POLICY "Admins can insert categories when allowed"
  ON public.categories
  FOR INSERT
  WITH CHECK (
    (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.accounts
        WHERE id = account_id
          AND can_add_custom_categories = TRUE
      )
    )
    OR public.is_master_user()
  );

CREATE POLICY "Admins can delete categories"
  ON public.categories
  FOR DELETE
  USING (
    (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  );

-- Project codes
CREATE POLICY "Account users can view project codes"
  ON public.project_codes
  FOR SELECT
  USING (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

CREATE POLICY "Admins manage project codes"
  ON public.project_codes
  FOR ALL
  USING (
    (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  )
  WITH CHECK (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

-- Files
CREATE POLICY "Account users can view files"
  ON public.files
  FOR SELECT
  USING (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

CREATE POLICY "Users upload files within account"
  ON public.files
  FOR INSERT
  WITH CHECK (
    (
      uploaded_by = auth.uid()
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  );

CREATE POLICY "Users update their files"
  ON public.files
  FOR UPDATE
  USING (
    (
      uploaded_by = auth.uid()
      AND account_id = public.get_account_id(auth.uid())
    )
    OR (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  )
  WITH CHECK (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

CREATE POLICY "Admins manage account files"
  ON public.files
  FOR DELETE
  USING (
    (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  );

-- Expenses
CREATE POLICY "Account members read expenses"
  ON public.expenses
  FOR SELECT
  USING (
    (
      account_id = public.get_account_id(auth.uid())
      AND (
        employee_id = auth.uid()
        OR public.is_account_admin(auth.uid())
      )
    )
    OR public.is_master_user()
  );

CREATE POLICY "Account members insert expenses"
  ON public.expenses
  FOR INSERT
  WITH CHECK (
    (
      account_id = public.get_account_id(auth.uid())
      AND (
        employee_id = auth.uid()
        OR public.is_account_admin(auth.uid())
      )
    )
    OR public.is_master_user()
  );

CREATE POLICY "Account members update expenses"
  ON public.expenses
  FOR UPDATE
  USING (
    (
      account_id = public.get_account_id(auth.uid())
      AND (
        (employee_id = auth.uid() AND status = 'PENDING'::public.expense_status)
        OR public.is_account_admin(auth.uid())
      )
    )
    OR public.is_master_user()
  )
  WITH CHECK (
    (
      account_id = public.get_account_id(auth.uid())
      AND (
        employee_id = auth.uid()
        OR public.is_account_admin(auth.uid())
      )
    )
    OR public.is_master_user()
  );

CREATE POLICY "Admins delete account expenses"
  ON public.expenses
  FOR DELETE
  USING (
    (
      public.is_account_admin(auth.uid())
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  );

-- Audit logs
CREATE POLICY "Account users view audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    account_id = public.get_account_id(auth.uid())
    OR public.is_master_user()
  );

CREATE POLICY "Account users insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    (
      actor_user_id = auth.uid()
      AND account_id = public.get_account_id(auth.uid())
    )
    OR public.is_master_user()
  );

COMMIT;
