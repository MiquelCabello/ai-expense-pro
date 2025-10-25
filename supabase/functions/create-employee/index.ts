

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
const MASTER_EMAIL = "info@miquelcabello.com";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization") || "";
  const authToken = authHeader.replace("Bearer", "").trim();

  if (!authToken) {
    return new Response(JSON.stringify({ error: "missing_token" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const { data: { user: adminUser }, error: authError } = await adminClient.auth.getUser(authToken);

  if (authError || !adminUser) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const isMaster = adminUser.email?.toLowerCase() === MASTER_EMAIL;

  // Cargar membership (sistema nuevo)
  const { data: membership } = await adminClient
    .from('memberships')
    .select('role, company_id')
    .eq('user_id', adminUser.id)
    .maybeSingle();

  const isAdmin = isMaster || 
    membership?.role === 'owner' || 
    membership?.role === 'company_admin' || 
    membership?.role === 'global_admin';

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  const companyId = membership?.company_id;
  if (!companyId && !isMaster) {
    return new Response(JSON.stringify({ error: "no_company" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const { data: company } = await adminClient
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .maybeSingle();

  let payload: {
    name?: string;
    email?: string;
    role?: string;
    department?: string | null;
    country?: string | null;
    city?: string | null;
    companyId?: string;
  };
  
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim().toLowerCase();
  const targetCompanyId = payload.companyId || companyId;

  if (!name || !email) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  // Validar límites
  if (company?.max_employees) {
    const { count } = await adminClient
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', targetCompanyId);

    if (count && count >= company.max_employees) {
      return new Response(JSON.stringify({ error: 'EMPLOYEE_LIMIT_REACHED' }), {
        status: 409,
        headers: jsonHeaders,
      });
    }
  }

  // Mapear rol
  const requestedRole = payload.role || 'EMPLOYEE';
  const mappedRole = requestedRole === 'ADMIN' ? 'company_admin' : 
                     requestedRole === 'DEPARTMENT_ADMIN' ? 'department_admin' : 'employee';

  // Obtener department_id
  let departmentId = null;
  if (payload.department) {
    const { data: dept } = await adminClient
      .from('departments')
      .select('id')
      .eq('company_id', targetCompanyId)
      .eq('name', payload.department)
      .maybeSingle();
    
    departmentId = dept?.id || null;
  }

  // Usar Supabase Auth para invitar usuario (envía email automáticamente)
  const { data: authData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      name,
      role: mappedRole,
      department_id: departmentId,
      company_id: targetCompanyId,
      invited_by: adminUser.id,
      country: payload.country,
      city: payload.city,
    },
    redirectTo: 'https://ai-expense-pro.vercel.app/auth',
  });

  if (inviteError) {
    console.error('[create-employee] Failed to invite user:', inviteError);
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  // Crear/actualizar perfil con datos adicionales
  await adminClient
    .from('profiles_v2')
    .upsert({
      user_id: authData.user!.id,
      email,
      name,
      country: payload.country || null,
      city: payload.city || null,
    });

  // Generar token único
  const invitationToken = crypto.randomUUID();

  // Crear invitación
  const { data: invitation, error: invitationError } = await adminClient
    .from('invitations')
    .insert({
      email,
      token: invitationToken,
      role: mappedRole,
      department_id: departmentId,
      company_id: targetCompanyId,
      invited_by: adminUser.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (invitationError) {
    console.error('[create-employee] Failed to create invitation:', invitationError);
    return new Response(JSON.stringify({ error: invitationError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const invitationUrl = `https://ai-expense-pro.vercel.app/accept-invite?token=${invitation.token}`;

  return new Response(JSON.stringify({ 
    success: true, 
    invitation_url: invitationUrl,
    message: 'Invitación creada exitosamente'
  }), {
    status: 200,
    headers: jsonHeaders,
  });
});