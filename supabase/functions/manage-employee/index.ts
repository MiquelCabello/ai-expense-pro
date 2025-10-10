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
