-- Hacer el bucket receipts público para permitir acceso a los logos
UPDATE storage.buckets
SET public = true
WHERE id = 'receipts';