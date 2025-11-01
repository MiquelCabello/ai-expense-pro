-- Añadir campo para el logo de la empresa
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS logo_url TEXT;