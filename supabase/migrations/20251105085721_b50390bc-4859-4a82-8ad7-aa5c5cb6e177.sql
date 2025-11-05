-- Agregar columnas para almacenar información de Dropbox en expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS dropbox_path TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS dropbox_url TEXT;

COMMENT ON COLUMN public.expenses.dropbox_path IS 'Ruta del archivo en Dropbox';
COMMENT ON COLUMN public.expenses.dropbox_url IS 'URL compartida del archivo en Dropbox';