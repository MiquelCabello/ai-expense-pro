import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  ...corsHeaders
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Authenticate the requesting user
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

    // Verify admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, account_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'ADMIN') {
      return new Response(
        JSON.stringify({ error: 'Only admins can manage employees' }),
        { status: 403, headers: jsonHeaders }
      );
    }

    const { action, employeeUserId, name, password } = await req.json();

    if (!action || !employeeUserId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // Verify employee belongs to same account
    const { data: employeeProfile } = await supabaseAdmin
      .from('profiles')
      .select('account_id')
      .eq('user_id', employeeUserId)
      .single();

    if (!employeeProfile || employeeProfile.account_id !== profile.account_id) {
      return new Response(
        JSON.stringify({ error: 'Employee not found or not in your account' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    if (action === 'update') {
      // Update name if provided
      if (name) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ name: name.trim() })
          .eq('user_id', employeeUserId);

        if (updateError) throw updateError;

        // === DUAL WRITE: Update in new system ===
        try {
          const { data: company } = await supabaseAdmin
            .from('companies')
            .select('id')
            .eq('migrated_from_account_id', employeeProfile.account_id)
            .maybeSingle();

          if (company) {
            console.log('[manage-employee] Name updated in old system, new system has no equivalent name field in memberships');
          }
        } catch (error) {
          console.warn('[manage-employee] Dual write check failed for name update:', error);
        }
      }

      // Update password if provided
      if (password) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          employeeUserId,
          { password }
        );

        if (passwordError) throw passwordError;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Employee updated successfully' }),
        { status: 200, headers: jsonHeaders }
      );
    } else if (action === 'delete') {
      // === DUAL WRITE: Delete from new system first ===
      try {
        const { data: company } = await supabaseAdmin
          .from('companies')
          .select('id')
          .eq('migrated_from_account_id', employeeProfile.account_id)
          .maybeSingle();

        if (company) {
          // Delete membership
          const { error: membershipDeleteError } = await supabaseAdmin
            .from('memberships')
            .delete()
            .eq('user_id', employeeUserId)
            .eq('company_id', company.id);

          if (membershipDeleteError) {
            console.warn('[manage-employee] Failed to delete membership:', membershipDeleteError);
          } else {
            console.log('[manage-employee] Deleted membership for user:', employeeUserId);
          }

          // Delete profiles_v2
          const { error: profileV2DeleteError } = await supabaseAdmin
            .from('profiles_v2')
            .delete()
            .eq('user_id', employeeUserId);

          if (profileV2DeleteError) {
            console.warn('[manage-employee] Failed to delete profiles_v2:', profileV2DeleteError);
          } else {
            console.log('[manage-employee] Deleted profiles_v2 for user:', employeeUserId);
          }
        }
      } catch (error) {
        console.warn('[manage-employee] Dual write failed for delete:', error);
      }

      // Delete user (cascade will delete profile)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        employeeUserId
      );

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true, message: 'Employee deleted successfully' }),
        { status: 200, headers: jsonHeaders }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: jsonHeaders }
      );
    }
  } catch (error: any) {
    console.error('[manage-employee] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
