-- Crear tabla de solicitudes de eliminación de gastos
CREATE TABLE IF NOT EXISTS public.expense_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en expense_deletion_requests
ALTER TABLE public.expense_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Política de lectura: el solicitante, reviewers y admins pueden ver
CREATE POLICY "deletion_req_read" ON public.expense_deletion_requests
  FOR SELECT
  USING (
    is_global_admin() 
    OR requested_by = auth.uid()
    OR has_company_role(company_id, ARRAY['owner', 'company_admin'])
  );

-- Política de inserción: department_admin y company_admin pueden crear solicitudes
CREATE POLICY "deletion_req_insert" ON public.expense_deletion_requests
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND (
      has_company_role(company_id, ARRAY['department_admin', 'company_admin', 'owner'])
    )
  );

-- Política de actualización: solo owner/company_admin pueden aprobar/rechazar
CREATE POLICY "deletion_req_update" ON public.expense_deletion_requests
  FOR UPDATE
  USING (
    has_company_role(company_id, ARRAY['owner', 'company_admin'])
  );

-- Añadir política DELETE en expenses: solo owner/company_admin pueden eliminar directamente
CREATE POLICY "exp_delete_direct" ON public.expenses
  FOR DELETE
  USING (
    is_global_admin() 
    OR has_company_role(company_id, ARRAY['owner', 'company_admin'])
  );

-- Trigger para actualizar updated_at en expense_deletion_requests
CREATE TRIGGER update_expense_deletion_requests_updated_at
  BEFORE UPDATE ON public.expense_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_deletion_requests_company_id ON public.expense_deletion_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_expense_id ON public.expense_deletion_requests(expense_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.expense_deletion_requests(status);