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

  console.log('[complete-invitation] Creating user for:', invitation.email);

  // Create user metadata
  const userMetadata: Record<string, unknown> = {
    name: invitation.name,
    role: invitation.role,
    account_id: invitation.account_id,
  };

  if (invitation.department) {
    userMetadata.department = invitation.department;
  }
  if (invitation.region) {
    userMetadata.region = invitation.region;
  }

  // Create the user
  const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: invitation.email,
    password: password,
    email_confirm: true, // Auto-confirm email
    user_metadata: userMetadata,
  });

  if (createUserError || !newUser.user) {
    console.error('[complete-invitation] Failed to create user:', createUserError);
    
    // Check if user already exists
    if (createUserError?.message?.includes('already registered')) {
      return new Response(JSON.stringify({ error: 'user_already_exists' }), {
        status: 409,
        headers: jsonHeaders,
      });
    }
    
    return new Response(JSON.stringify({ error: 'user_creation_failed' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  console.log('[complete-invitation] User created successfully:', newUser.user.id);

  // Mark invitation as used
  const { error: updateError } = await adminClient
    .from('invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invitation.id);

  if (updateError) {
    console.warn('[complete-invitation] Failed to mark invitation as used:', updateError);
  }

  // Create a session for the new user
  const { data: sessionData, error: sessionError } = await adminClient.auth.admin.createSession({
    user_id: newUser.user.id,
  });

  if (sessionError || !sessionData.session) {
    console.error('[complete-invitation] Failed to create session:', sessionError);
    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        message: 'user_created_no_session',
      }),
      {
        status: 200,
        headers: jsonHeaders,
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      user_id: newUser.user.id,
      session: sessionData.session,
      message: 'user_created',
    }),
    {
      status: 200,
      headers: jsonHeaders,
    }
  );
});
