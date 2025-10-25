-- Agregar columnas country y city a profiles_v2
ALTER TABLE public.profiles_v2 
ADD COLUMN country TEXT,
ADD COLUMN city TEXT,
ADD COLUMN name TEXT;

COMMENT ON COLUMN public.profiles_v2.country IS 'País del usuario';
COMMENT ON COLUMN public.profiles_v2.city IS 'Ciudad del usuario';
COMMENT ON COLUMN public.profiles_v2.name IS 'Nombre completo del usuario';