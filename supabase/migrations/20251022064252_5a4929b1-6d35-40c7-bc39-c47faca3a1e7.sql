-- ============================================================================
-- Corrección de seguridad: Añadir search_path a funciones trigger
-- ============================================================================

-- Corregir assert_enterprise_for_departments
CREATE OR REPLACE FUNCTION public.assert_enterprise_for_departments() 
RETURNS trigger 
LANGUAGE plpgsql 
SET search_path = public
AS $$
DECLARE v_plan plan_tier; 
BEGIN 
  SELECT c.plan INTO v_plan FROM public.companies c WHERE c.id = NEW.company_id;
  IF v_plan <> 'enterprise' THEN
    RAISE EXCEPTION 'Solo el plan Enterprise puede crear departamentos';
  END IF;
  RETURN NEW;
END;$$;

-- Corregir assert_category_quota
CREATE OR REPLACE FUNCTION public.assert_category_quota() 
RETURNS trigger 
LANGUAGE plpgsql 
SET search_path = public
AS $$
DECLARE 
  v_plan plan_tier; 
  v_count INT; 
  v_limit INT; 
BEGIN 
  SELECT c.plan INTO v_plan FROM public.companies c WHERE c.id = NEW.company_id;
  IF v_plan = 'enterprise' THEN 
    RETURN NEW; 
  END IF;
  
  v_limit := CASE WHEN v_plan = 'pro' THEN 4 ELSE 2 END;
  SELECT COUNT(*) INTO v_count FROM public.categories WHERE company_id = NEW.company_id;
  
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Límite de categorías alcanzado para el plan % (máximo: %)', v_plan, v_limit;
  END IF;
  
  RETURN NEW;
END;$$;

-- Corregir assert_monthly_expense_quota
CREATE OR REPLACE FUNCTION public.assert_monthly_expense_quota() 
RETURNS trigger 
LANGUAGE plpgsql 
SET search_path = public
AS $$
DECLARE 
  v_plan plan_tier; 
  v_count INT; 
BEGIN 
  SELECT c.plan INTO v_plan FROM public.companies c WHERE c.id = NEW.company_id;
  IF v_plan <> 'free' THEN 
    RETURN NEW; 
  END IF;
  
  SELECT COUNT(*) INTO v_count FROM public.expenses e
  WHERE e.company_id = NEW.company_id 
    AND date_trunc('month', e.expense_date) = date_trunc('month', NEW.expense_date);
  
  IF v_count >= 40 THEN
    RAISE EXCEPTION 'Límite mensual de 40 gastos alcanzado en plan Free';
  END IF;
  
  RETURN NEW;
END;$$;

-- Corregir update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS trigger 
LANGUAGE plpgsql 
SET search_path = public
AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END;$$;