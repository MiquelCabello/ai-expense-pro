/// <reference path="../types.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "server_not_configured" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let payload: {
    token?: string;
    password?: string;
  };

  try {
    payload = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const { token, password } = payload;

  if (!token || !password) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  // Validate password
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: "password_too_short" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  // Fetch invitation
  const { data: invitation, error: invitationError } = await adminClient
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .maybeSingle();

  if (invitationError) {
    console.error('[complete-invitation] Error fetching invitation:', invitationError);
    return new Response(JSON.stringify({ error: 'invitation_fetch_failed' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  if (!invitation) {
    return new Response(JSON.stringify({ error: 'invalid_or_used_token' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  // Check if expired
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'invitation_expired' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  console.log('[complete-invitation] Processing invitation for:', invitation.email);

  // Create user metadata
  const userMetadata: Record<string, unknown> = {
    role: invitation.role,
    company_id: invitation.company_id,
  };

  if (invitation.department_id) {
    userMetadata.department_id = invitation.department_id;
  }

  // Check if user already exists (created by inviteUserByEmail)
  const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
  
  if (listError) {
    console.error('[complete-invitation] Error listing users:', listError);
    return new Response(JSON.stringify({ error: 'user_lookup_failed' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const existingUser = existingUsers.users.find(u => u.email?.toLowerCase() === invitation.email.toLowerCase());
  
  let userId: string;

  if (existingUser) {
    // User already exists (created by inviteUserByEmail), just update password
    console.log('[complete-invitation] User already exists, updating password:', existingUser.id);
    
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      existingUser.id,
      {
        password: password,
        email_confirm: true,
        user_metadata: userMetadata,
      }
    );

    if (updateError || !updatedUser.user) {
      console.error('[complete-invitation] Failed to update user password:', updateError);
      return new Response(JSON.stringify({ error: 'password_update_failed' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    userId = updatedUser.user.id;
    console.log('[complete-invitation] User password updated successfully:', userId);
  } else {
    // User doesn't exist, create it (fallback case)
    console.log('[complete-invitation] Creating new user for:', invitation.email);
    
    const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (createUserError || !newUser.user) {
      console.error('[complete-invitation] Failed to create user:', createUserError);
      return new Response(JSON.stringify({ error: 'user_creation_failed' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    userId = newUser.user.id;
    console.log('[complete-invitation] User created successfully:', userId);
  }

  // === Sistema nuevo: companies/memberships/profiles_v2 ===
  console.log('[complete-invitation] Creating membership in new system');
  
  try {
    // 1. Obtener company_id directamente de la invitación
    const companyId = invitation.company_id;
    console.log('[complete-invitation] Using company:', companyId);

    // 2. Crear profile en profiles_v2
    const { error: profileV2Error } = await adminClient
      .from('profiles_v2')
      .insert({
        user_id: userId,
        email: invitation.email,
      });

    if (profileV2Error) {
      console.warn('[complete-invitation] Failed to create profiles_v2:', profileV2Error.message);
    } else {
      console.log('[complete-invitation] Created profiles_v2 for user:', userId);
    }

    // 3. Crear membership (el role ya viene en el formato correcto role_company)
    const { error: membershipError } = await adminClient
      .from('memberships')
      .insert({
        user_id: userId,
        company_id: companyId,
        role: invitation.role,
        department_id: invitation.department_id,
      });

    if (membershipError) {
      console.warn('[complete-invitation] Failed to create membership:', membershipError.message);
    } else {
      console.log('[complete-invitation] Created membership for user:', userId);
    }
  } catch (systemError) {
    console.error('[complete-invitation] System write failed:', systemError);
    // No bloqueamos el flujo si falla el nuevo sistema
  }

  // Mark invitation as used
  const { error: updateError } = await adminClient
    .from('invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invitation.id);

  if (updateError) {
    console.warn('[complete-invitation] Failed to mark invitation as used:', updateError);
    return new Response(
      JSON.stringify({ 
        error: 'invitation_update_failed',
        details: updateError.message 
      }),
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }

  console.log('[complete-invitation] Invitation marked as used successfully');
  console.log('[complete-invitation] User activation complete. User should log in with their new password.');

  // Return success without session - user will need to log in
  return new Response(
    JSON.stringify({
      success: true,
      user_id: userId,
      email: invitation.email,
      message: 'invitation_completed',
    }),
    {
      status: 200,
      headers: jsonHeaders,
    }
  );
});
