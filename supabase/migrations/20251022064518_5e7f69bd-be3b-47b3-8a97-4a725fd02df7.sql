-- ============================================================================
-- Crear tabla de invitaciones para empleados
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role role_company NOT NULL DEFAULT 'employee',
  department_id UUID REFERENCES public.departments(id),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_company ON public.invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);

-- RLS para invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Lectura: admin o el invitado puede ver su invitación por token
CREATE POLICY inv_read ON public.invitations 
  FOR SELECT 
  USING (
    public.is_global_admin()
    OR public.has_company_role(company_id, ARRAY['owner','company_admin'])
    OR (email = (SELECT p.email FROM public.profiles_v2 p WHERE p.user_id = auth.uid()))
  );

-- Escritura: solo admin puede crear invitaciones
CREATE POLICY inv_write ON public.invitations 
  FOR ALL 
  USING (
    public.is_global_admin() 
    OR public.has_company_role(company_id, ARRAY['owner','company_admin'])
  );