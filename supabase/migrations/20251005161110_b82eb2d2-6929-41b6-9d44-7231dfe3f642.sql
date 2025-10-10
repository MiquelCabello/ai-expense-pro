-- Añadir políticas RLS para account_departments

-- Todos los usuarios autenticados pueden ver departamentos de su cuenta
CREATE POLICY "Users can view departments in their account"
  ON public.account_departments
  FOR SELECT
  USING (
    is_master_user(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.account_id = account_departments.account_id
    )
  );

-- Los propietarios y admins globales pueden gestionar departamentos
CREATE POLICY "Account owners and admins can manage departments"
  ON public.account_departments
  FOR ALL
  USING (
    is_master_user(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_departments.account_id
        AND accounts.owner_user_id = auth.uid()
    )
    OR
    check_user_role(auth.uid(), account_departments.account_id, 'account_admin')
  );