-- Eliminar políticas antiguas que usan sistema legacy
DROP POLICY IF EXISTS "storage_receipts_select_own_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "storage_receipts_insert_self" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company logos" ON storage.objects;

-- Políticas para receipts (gastos individuales)
CREATE POLICY "receipts_select_own_receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = 'receipts'
  AND (
    -- El usuario puede ver sus propios receipts
    auth.uid()::text = (storage.foldername(name))[2]
    -- O es admin de alguna empresa
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner', 'company_admin')
    )
    -- O es master
    OR is_master_dual()
  )
);

CREATE POLICY "receipts_insert_own_receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "receipts_update_own_receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "receipts_delete_own_receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Políticas para logos de empresa
CREATE POLICY "logos_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = 'logos'
);

CREATE POLICY "logos_insert_company_admins"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = 'logos'
  AND (
    is_master_dual()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner', 'company_admin')
    )
  )
);

CREATE POLICY "logos_update_company_admins"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = 'logos'
  AND (
    is_master_dual()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner', 'company_admin')
    )
  )
);

CREATE POLICY "logos_delete_company_admins"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = 'logos'
  AND (
    is_master_dual()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner', 'company_admin')
    )
  )
);