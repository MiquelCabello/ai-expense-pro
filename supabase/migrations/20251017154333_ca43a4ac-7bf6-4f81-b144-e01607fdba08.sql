-- Crear políticas para permitir a los administradores subir logos de empresa
CREATE POLICY "Admins can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = 'logos'
  AND (
    is_master_dual()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner', 'company_admin', 'global_admin')
    )
  )
);

CREATE POLICY "Anyone can view company logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = 'logos'
);

CREATE POLICY "Admins can update company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = 'logos'
  AND (
    is_master_dual()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner', 'company_admin', 'global_admin')
    )
  )
);

CREATE POLICY "Admins can delete company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = 'logos'
  AND (
    is_master_dual()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner', 'company_admin', 'global_admin')
    )
  )
);