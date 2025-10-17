-- Fix WARN 6-7: Function Search Path Mutable
-- Actualizar la función update_updated_at_column_v2 con search_path configurado

CREATE OR REPLACE FUNCTION public.update_updated_at_column_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;