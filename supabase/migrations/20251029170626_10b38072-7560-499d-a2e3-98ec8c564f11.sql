-- Remove the global unique constraint on category name
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- Add a composite unique constraint to prevent duplicate category names within the same company
ALTER TABLE public.categories ADD CONSTRAINT categories_name_company_unique UNIQUE (name, company_id);