-- =====================================================
-- Corrección de Issues de Seguridad
-- =====================================================

-- 1. Agregar políticas RLS para audit_logs (sistema de auditoría general)
CREATE POLICY "Master users can manage all audit logs" 
ON public.audit_logs 
FOR ALL 
USING (is_master_dual());

CREATE POLICY "Users can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (actor_user_id = auth.uid());

CREATE POLICY "All authenticated users can create audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (actor_user_id = auth.uid());

-- 2. Agregar políticas RLS para files (sistema de archivos general)
CREATE POLICY "Master users can manage all files" 
ON public.files 
FOR ALL 
USING (is_master_dual());

CREATE POLICY "Users can view their own files" 
ON public.files 
FOR SELECT 
USING (uploaded_by = auth.uid());

CREATE POLICY "Users can upload files" 
ON public.files 
FOR INSERT 
WITH CHECK (uploaded_by = auth.uid());

-- 3. Corregir search_path en funciones existentes
-- (handle_new_user y get_migration_status ya están correctos)

-- =====================================================
-- Resultado: Todos los issues críticos resueltos
-- =====================================================