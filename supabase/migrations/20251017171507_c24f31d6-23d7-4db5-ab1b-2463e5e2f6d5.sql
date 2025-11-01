-- =====================================================
-- Paso 4: Corregir search_path en función restante
-- =====================================================

-- Corregir get_migration_status
ALTER FUNCTION public.get_migration_status() SET search_path = public;