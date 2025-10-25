import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  ...corsHeaders
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    // Verificar rol de admin usando el sistema nuevo
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single();

    const isAdmin = membership?.role === 'owner' || 
                    membership?.role === 'company_admin' || 
                    membership?.role === 'global_admin';

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can manage employees' }),
        { status: 403, headers: jsonHeaders }
      );
    }

    const { action, employeeUserId, name, password, companyId } = await req.json();

    if (!action || !employeeUserId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const targetCompanyId = companyId || membership.company_id;

    // Verificar que el empleado pertenece a la empresa
    const { data: employeeMembership } = await supabaseAdmin
      .from('memberships')
      .select('*')
      .eq('user_id', employeeUserId)
      .eq('company_id', targetCompanyId)
      .single();

    if (!employeeMembership) {
      return new Response(
        JSON.stringify({ error: 'Employee not found or not in your company' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    if (action === 'update') {
      if (name) {
        // No hay campo name en profiles_v2, se usa email
        console.log('[manage-employee] Name field not used in new system');
      }

      if (password) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          employeeUserId,
          { password }
        );

        if (passwordError) {
          console.error('[manage-employee] Error updating password:', passwordError);
          return new Response(JSON.stringify({ error: 'Error al actualizar contraseña' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Employee updated successfully' }),
        { status: 200, headers: jsonHeaders }
      );
    } else if (action === 'delete') {
      // Eliminar membership
      const { error: membershipError } = await supabaseAdmin
        .from('memberships')
        .delete()
        .eq('user_id', employeeUserId)
        .eq('company_id', targetCompanyId);

      if (membershipError) {
        console.error('[manage-employee] Error deleting membership:', membershipError);
        return new Response(JSON.stringify({ error: 'Error al eliminar empleado' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      // Eliminar usuario
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(employeeUserId);

      if (deleteUserError) {
        console.error('[manage-employee] Error deleting user:', deleteUserError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Employee deleted successfully' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: jsonHeaders }
    );
  } catch (error: any) {
    console.error('[manage-employee] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: jsonHeaders }
    );
  }
});