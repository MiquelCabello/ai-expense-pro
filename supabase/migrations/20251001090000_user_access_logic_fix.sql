BEGIN;

-- Ensure master user is treated as account admin for policy checks
CREATE OR REPLACE FUNCTION public.is_account_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  public.is_master_user()
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _uid
      AND role = 'ADMIN'::public.user_role
      AND status = 'ACTIVE'::public.user_status
  );
$$;

-- Profiles ---------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_account_members" ON public.profiles;
CREATE POLICY "profiles_select_account_members"
ON public.profiles
FOR SELECT
USING (
  public.is_master_user()
  OR account_id = public.get_account_id(auth.uid())
);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin"
ON public.profiles
FOR UPDATE
USING (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      user_id = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.profiles.account_id
      )
    )
  )
)
WITH CHECK (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      user_id = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.profiles.account_id
      )
    )
  )
);

DROP POLICY IF EXISTS "profiles_insert_admin_only" ON public.profiles;
CREATE POLICY "profiles_insert_admin_only"
ON public.profiles
FOR INSERT
WITH CHECK (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND public.is_account_admin(auth.uid())
    AND public.get_account_id(auth.uid()) = public.profiles.account_id
  )
);

DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only"
ON public.profiles
FOR DELETE
USING (
  public.is_master_user()
  OR (
    public.is_account_admin(auth.uid())
    AND public.get_account_id(auth.uid()) = public.profiles.account_id
  )
);

-- Categories ------------------------------------------------------------
DROP POLICY IF EXISTS "categories_select_account_members" ON public.categories;
CREATE POLICY "categories_select_account_members"
ON public.categories
FOR SELECT
USING (
  public.is_master_user()
  OR account_id = public.get_account_id(auth.uid())
);

DROP POLICY IF EXISTS "categories_write_admin_only" ON public.categories;
CREATE POLICY "categories_write_admin_only"
ON public.categories
FOR ALL
USING (
  public.is_master_user()
  OR (
    public.is_account_admin(auth.uid())
    AND public.get_account_id(auth.uid()) = public.categories.account_id
  )
)
WITH CHECK (
  public.is_master_user()
  OR (
    public.is_account_admin(auth.uid())
    AND public.get_account_id(auth.uid()) = public.categories.account_id
  )
);

-- Project codes ---------------------------------------------------------
DROP POLICY IF EXISTS "project_codes_select_account_members" ON public.project_codes;
CREATE POLICY "project_codes_select_account_members"
ON public.project_codes
FOR SELECT
USING (
  public.is_master_user()
  OR account_id = public.get_account_id(auth.uid())
);

DROP POLICY IF EXISTS "project_codes_write_admin_only" ON public.project_codes;
CREATE POLICY "project_codes_write_admin_only"
ON public.project_codes
FOR ALL
USING (
  public.is_master_user()
  OR (
    public.is_account_admin(auth.uid())
    AND public.get_account_id(auth.uid()) = public.project_codes.account_id
  )
)
WITH CHECK (
  public.is_master_user()
  OR (
    public.is_account_admin(auth.uid())
    AND public.get_account_id(auth.uid()) = public.project_codes.account_id
  )
);

-- Files -----------------------------------------------------------------
DROP POLICY IF EXISTS "files_select_account_members" ON public.files;
CREATE POLICY "files_select_account_members"
ON public.files
FOR SELECT
USING (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      uploaded_by = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.files.account_id
      )
    )
  )
);

DROP POLICY IF EXISTS "files_insert_same_account" ON public.files;
CREATE POLICY "files_insert_same_account"
ON public.files
FOR INSERT
WITH CHECK (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND uploaded_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "files_update_owner_or_admin" ON public.files;
CREATE POLICY "files_update_owner_or_admin"
ON public.files
FOR UPDATE
USING (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      uploaded_by = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.files.account_id
      )
    )
  )
)
WITH CHECK (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      uploaded_by = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.files.account_id
      )
    )
  )
);

DROP POLICY IF EXISTS "files_delete_admin_only" ON public.files;
CREATE POLICY "files_delete_admin_only"
ON public.files
FOR DELETE
USING (
  public.is_master_user()
  OR (
    public.is_account_admin(auth.uid())
    AND public.get_account_id(auth.uid()) = public.files.account_id
  )
);

-- Expenses --------------------------------------------------------------
DROP POLICY IF EXISTS "expenses_select_account_members" ON public.expenses;
CREATE POLICY "expenses_select_account_members"
ON public.expenses
FOR SELECT
USING (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      employee_id = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.expenses.account_id
      )
    )
  )
);

DROP POLICY IF EXISTS "expenses_insert_same_account" ON public.expenses;
CREATE POLICY "expenses_insert_same_account"
ON public.expenses
FOR INSERT
WITH CHECK (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      employee_id = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.expenses.account_id
      )
    )
  )
);

DROP POLICY IF EXISTS "expenses_update_owner_or_admin" ON public.expenses;
CREATE POLICY "expenses_update_owner_or_admin"
ON public.expenses
FOR UPDATE
USING (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      (
        employee_id = auth.uid()
        AND status = 'PENDING'::public.expense_status
      )
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.expenses.account_id
      )
    )
  )
)
WITH CHECK (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      employee_id = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.expenses.account_id
      )
    )
  )
);

DROP POLICY IF EXISTS "expenses_delete_admin_only" ON public.expenses;
CREATE POLICY "expenses_delete_admin_only"
ON public.expenses
FOR DELETE
USING (
  public.is_master_user()
  OR (
    public.is_account_admin(auth.uid())
    AND public.get_account_id(auth.uid()) = public.expenses.account_id
  )
);

-- Audit logs ------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_select_account_members" ON public.audit_logs;
CREATE POLICY "audit_logs_select_account_members"
ON public.audit_logs
FOR SELECT
USING (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND (
      actor_user_id = auth.uid()
      OR (
        public.is_account_admin(auth.uid())
        AND public.get_account_id(auth.uid()) = public.audit_logs.account_id
      )
    )
  )
);

DROP POLICY IF EXISTS "audit_logs_insert_same_account" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_same_account"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  public.is_master_user()
  OR (
    account_id = public.get_account_id(auth.uid())
    AND actor_user_id = auth.uid()
  )
);

COMMIT;
