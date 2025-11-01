-- Agregar validación de coherencia para expenses
-- Garantiza que category_id y project_code_id pertenezcan a la misma company_id

CREATE OR REPLACE FUNCTION validate_expense_company_coherence()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que category pertenece a la misma company
  IF NEW.category_id IS NOT NULL AND NEW.company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = NEW.category_id AND c.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'Category % does not belong to company %', NEW.category_id, NEW.company_id;
    END IF;
  END IF;
  
  -- Validar que project_code pertenece a la misma company
  IF NEW.project_code_id IS NOT NULL AND NEW.company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.project_codes pc
      WHERE pc.id = NEW.project_code_id AND pc.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'Project code % does not belong to company %', NEW.project_code_id, NEW.company_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER expenses_validate_company_coherence
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION validate_expense_company_coherence();