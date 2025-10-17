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
const MASTER_EMAIL = "info@miquelcabello.com";
const inviteRedirectEnv = Deno.env.get("INVITE_REDIRECT_URL") ?? null;

type AccountRow = {
  id: string;
  name: string;
  plan: string;
  owner_user_id: string;
  max_employees: number | null;
  can_assign_roles: boolean;
  can_assign_department: boolean;
  can_assign_region: boolean;
  can_add_custom_categories: boolean;
  monthly_expense_limit: number | null;
};

type ProfileRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  account_id: string | null;
  account?: AccountRow | null;
};

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer", "").trim();

  if (!token) {
    return new Response(JSON.stringify({ error: "missing_token" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const {
    data: { user: adminUser },
    error: authError,
  } = await adminClient.auth.getUser(token);

  if (authError || !adminUser) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const accountSelect = `
    id,
    name,
    plan,
    owner_user_id,
    max_employees,
    can_assign_roles,
    can_assign_department,
    can_assign_region,
    can_add_custom_categories,
    monthly_expense_limit
  `;

  const { data: profileDataRaw, error: profileError } = await adminClient
    .from('profiles')
    .select(`
      id,
      user_id,
      role,
      status,
      account_id,
      account:accounts (
        ${accountSelect}
      )
    `)
    .eq('user_id', adminUser.id)
    .maybeSingle<ProfileRow>();

  let accountTableAvailable = true;
  let profileData: ProfileRow | null = profileDataRaw ?? null;

  if (profileError) {
    const relationshipMissing = profileError.code === 'PGRST200' ||
      profileError.code === 'PGRST205' ||
      (typeof profileError.message === 'string' && profileError.message.includes('schema cache'));

    if (relationshipMissing) {
      accountTableAvailable = false;
      const { data: fallbackProfile, error: fallbackProfileError } = await adminClient
        .from('profiles')
        .select(`
          id,
          user_id,
          role,
          status,
          account_id
        `)
        .eq('user_id', adminUser.id)
        .maybeSingle<ProfileRow>();

      if (fallbackProfile) {
        profileData = { ...fallbackProfile, account: null };
      }

      if (fallbackProfileError) {
        console.warn('[create-employee] fallback profile lookup failed', fallbackProfileError);
      }
    } else {
      console.warn('[create-employee] profile lookup failed', profileError);
    }
  }

  let account: AccountRow | null = null;
  if (accountTableAvailable && profileDataRaw?.account) {
    account = profileDataRaw.account ?? null;
  }
  let accountId = profileData?.account_id as string | null;
  let actorRole = profileData?.role ?? null;
  let actorStatus = profileData?.status ?? null;

  if (!profileData && adminUser.email && adminUser.email.toLowerCase() === MASTER_EMAIL) {
    const masterAccount: AccountRow = {
      id: adminUser.id,
      name: adminUser.email ?? 'Cuenta principal',
      plan: 'ENTERPRISE',
      owner_user_id: adminUser.id,
      max_employees: null,
      can_assign_roles: true,
      can_assign_department: true,
      can_assign_region: true,
      can_add_custom_categories: true,
      monthly_expense_limit: null,
    };
    account = masterAccount;
    accountId = adminUser.id;
    actorRole = 'ADMIN';
    actorStatus = 'ACTIVE';
  }

  if (accountTableAvailable && profileData && !account && accountId) {
    const { data: accountRow, error: accountFetchError } = await adminClient
      .from('accounts')
      .select(accountSelect)
      .eq('id', accountId)
      .maybeSingle<AccountRow>();
    if (!accountFetchError && accountRow) {
      account = accountRow;
    }
  }

  if (accountTableAvailable && !account) {
    const { data: ownedAccount, error: ownedAccountError } = await adminClient
      .from('accounts')
      .select(accountSelect)
      .eq('owner_user_id', adminUser.id)
      .maybeSingle<AccountRow>();

    if (ownedAccount) {
      account = ownedAccount;
      accountId = ownedAccount.id;

      if (profileData) {
        if (profileData.account_id !== accountId || profileData.role !== 'ADMIN' || profileData.status !== 'ACTIVE') {
          const { error: profileSyncError } = await adminClient
            .from('profiles')
            .update({
              account_id: accountId,
              role: 'ADMIN',
              status: 'ACTIVE',
            })
            .eq('user_id', adminUser.id);

          if (profileSyncError) {
            console.warn('[create-employee] unable to sync profile with owned account', profileSyncError);
          } else {
            actorRole = 'ADMIN';
            actorStatus = 'ACTIVE';
          }
        }
      } else {
        actorRole = 'ADMIN';
        actorStatus = 'ACTIVE';
      }
    } else if (ownedAccountError) {
      console.warn('[create-employee] owner account lookup failed', ownedAccountError);
    }
  }

  if (accountTableAvailable && !account) {
    const fallbackName = (adminUser.user_metadata as Record<string, unknown> | null)?.company_name;
    const derivedName = typeof fallbackName === 'string' && fallbackName.length > 0
      ? fallbackName
      : adminUser.email ?? 'Cuenta principal';

    const { data: createdAccount, error: createAccountError } = await adminClient
      .from('accounts')
      .insert({
        owner_user_id: adminUser.id,
        name: derivedName,
        plan: 'FREE',
      })
      .select(accountSelect)
      .maybeSingle<AccountRow>();

    if (createAccountError || !createdAccount) {
      const isUniqueViolation = createAccountError?.code === '23505' ||
        (createAccountError?.message && createAccountError.message.includes('duplicate key value'));

      if (isUniqueViolation) {
        const { data: existingAccount, error: existingAccountError } = await adminClient
          .from('accounts')
          .select(accountSelect)
          .eq('owner_user_id', adminUser.id)
          .maybeSingle<AccountRow>();

        if (existingAccount) {
          account = existingAccount;
          accountId = existingAccount.id;
        } else {
          console.error('[create-employee] account exists but lookup failed after unique violation', existingAccountError);
          return new Response(JSON.stringify({ error: 'account_lookup_failed' }), {
            status: 500,
            headers: jsonHeaders,
          });
        }
      } else {
        console.error('[create-employee] failed to auto-create account', createAccountError);
        return new Response(JSON.stringify({ error: 'account_provision_failed' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    } else {
      account = createdAccount;
      accountId = createdAccount.id;
    }

    if (accountTableAvailable) {
      const { error: profileUpdateError } = await adminClient
        .from('profiles')
        .update({
          account_id: accountId,
          role: 'ADMIN',
          status: 'ACTIVE',
        })
        .eq('user_id', adminUser.id);

      if (profileUpdateError) {
        console.warn('[create-employee] unable to update profile with new account', profileUpdateError);
      } else {
        actorRole = 'ADMIN';
        actorStatus = 'ACTIVE';
      }
    }
  }

  if (!account) {
    const fallbackAccount: AccountRow = {
      id: adminUser.id,
      name: adminUser.email ?? 'Cuenta principal',
      plan: 'FREE',
      owner_user_id: adminUser.id,
      max_employees: null,
      can_assign_roles: false,
      can_assign_department: true,
      can_assign_region: true,
      can_add_custom_categories: true,
      monthly_expense_limit: null,
    };
    account = fallbackAccount;
  }

  if (!account || actorRole !== 'ADMIN' || actorStatus !== 'ACTIVE') {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  let payload: {
    name?: string;
    email?: string;
    role?: string;
    department?: string | null;
    region?: string | null;
    redirectTo?: string | null;
  };
  try {
    payload = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim().toLowerCase();

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

  // Professional plans can have up to 2 department admins
  const allowsDepartmentAdmins = (account.plan === 'PROFESSIONAL' || account.plan === 'ENTERPRISE') && account.can_assign_roles === true;
  const allowsGlobalAdmins = account.plan === 'ENTERPRISE' && account.can_assign_roles === true;
  
  const requestedRole = payload.role || 'EMPLOYEE';
  let normalizedRole = 'EMPLOYEE';
  
  if (allowsGlobalAdmins && requestedRole === 'ADMIN') {
    normalizedRole = 'ADMIN';
  } else if (allowsDepartmentAdmins && requestedRole === 'DEPARTMENT_ADMIN') {
    normalizedRole = 'DEPARTMENT_ADMIN'; // Keep DEPARTMENT_ADMIN role
  }
  const rawDepartment = typeof payload.department === 'string' ? payload.department.trim() : '';
  const rawRegion = typeof payload.region === 'string' ? payload.region.trim() : '';
  const normalizedDepartment = account.can_assign_department ? (rawDepartment || null) : null;
  const normalizedRegion = account.can_assign_region ? (rawRegion || null) : null;

  // Build redirect URL prioritizing deployed URLs over preview
  const redirectCandidates: string[] = [];
  const rawRedirect = typeof payload.redirectTo === 'string' ? payload.redirectTo.trim() : '';
  if (rawRedirect.length > 0) {
    redirectCandidates.push(rawRedirect);
  }
  
  // Add production domain first (higher priority)
  redirectCandidates.push('https://ai-expense-pro.vercel.app/accept-invite');
  
  if (inviteRedirectEnv) {
    redirectCandidates.push(inviteRedirectEnv);
  }
  
  const requestOrigin = req.headers.get('origin');
  if (requestOrigin) {
    try {
      redirectCandidates.push(new URL('/accept-invite', requestOrigin).toString());
    } catch (error) {
      console.warn('[create-employee] invalid origin for redirect candidate', error);
    }
  }

  let inviteRedirectTo: string | null = null;
  for (const candidate of redirectCandidates) {
    try {
      const url = new URL(candidate);
      inviteRedirectTo = url.toString();
      console.log('[create-employee] Selected redirect URL:', inviteRedirectTo);
      break;
    } catch (error) {
      console.warn('[create-employee] skipped invalid redirect URL candidate', candidate, error);
    }
  }

  let activeCount: number | null = null;

  if (accountTableAvailable) {
    const { count, error: countError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id)
      .eq('status', 'ACTIVE');

    if (countError) {
      return new Response(JSON.stringify({ error: 'count_failed' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    activeCount = count;
  }

  if (
    accountTableAvailable &&
    typeof account.max_employees === 'number' &&
    activeCount !== null &&
    activeCount >= account.max_employees
  ) {
    return new Response(JSON.stringify({ error: 'EMPLOYEE_LIMIT_REACHED' }), {
      status: 409,
      headers: jsonHeaders,
    });
  }

  const accountIdentifier = accountId ?? account.id;
  const accountOwnerId = account?.owner_user_id ?? adminUser.id;

  // Check department admin limit for Professional plans
  if (requestedRole === 'DEPARTMENT_ADMIN' && allowsDepartmentAdmins) {
    const { count: departmentAdminCount, error: countError } = await adminClient
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountIdentifier)
      .eq('role', 'department_admin');

    if (countError) {
      console.error('[create-employee] Failed to count department admins', countError);
      return new Response(JSON.stringify({ error: 'count_failed' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const maxDepartmentAdmins = account.plan === 'PROFESSIONAL' ? 2 : null;
    if (maxDepartmentAdmins !== null && (departmentAdminCount ?? 0) >= maxDepartmentAdmins) {
      return new Response(JSON.stringify({ error: 'DEPARTMENT_ADMIN_LIMIT_REACHED' }), {
        status: 409,
        headers: jsonHeaders,
      });
    }
  }

  // CRITICAL: Los metadatos DEBEN incluir account_id para que el trigger handle_new_user
  // identifique correctamente que es un empleado de una cuenta existente
  const userMetadata: Record<string, unknown> = {
    name,
    role: normalizedRole,
    account_id: accountIdentifier, // Siempre incluir account_id
    account_owner_id: accountOwnerId,
  };

  // Solo agregar department y region si están permitidos por el plan
  if (normalizedDepartment) {
    userMetadata.department = normalizedDepartment;
  }
  if (normalizedRegion) {
    userMetadata.region = normalizedRegion;
  }

  console.log('[create-employee] Creating invitation for:', email);

  // Instead of creating user immediately, create an invitation record
  const { data: invitation, error: invitationError } = await adminClient
    .from('invitations')
    .insert({
      email,
      name,
      role: normalizedRole,
      department: normalizedDepartment,
      region: normalizedRegion,
      account_id: accountIdentifier,
      created_by: adminUser.id,
      expires_at: null, // Never expires
    })
    .select('id, token')
    .single();

  if (invitationError || !invitation) {
    console.error('[create-employee] Failed to create invitation:', invitationError);
    return new Response(JSON.stringify({ error: 'invitation_creation_failed' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  console.log('[create-employee] Invitation created with token:', invitation.token);

  // === DUAL WRITE: Preparar datos en el nuevo sistema ===
  console.log('[create-employee] Starting dual write preparation to new system');
  
  try {
    // 1. Verificar si existe la company migrada desde esta account
    const { data: company } = await adminClient
      .from('companies')
      .select('id, plan')
      .eq('migrated_from_account_id', accountIdentifier)
      .maybeSingle();

    if (company) {
      console.log('[create-employee] Found migrated company:', company.id);

      // 2. Si hay department y no existe en nuevo sistema, crearlo
      if (normalizedDepartment) {
        const { data: existingDepartment } = await adminClient
          .from('departments')
          .select('id')
          .eq('company_id', company.id)
          .eq('name', normalizedDepartment)
          .maybeSingle();

        if (!existingDepartment) {
          // Crear el departamento en el nuevo sistema
          const { data: newDepartment, error: deptCreateError } = await adminClient
            .from('departments')
            .insert({
              company_id: company.id,
              name: normalizedDepartment,
            })
            .select('id')
            .maybeSingle();

          if (deptCreateError) {
            console.warn('[create-employee] Failed to create department in new system:', deptCreateError);
          } else {
            console.log('[create-employee] Created department in new system:', newDepartment?.id);
          }
        } else {
          console.log('[create-employee] Department already exists in new system:', existingDepartment.id);
        }
      }

      // 3. Si el rol es DEPARTMENT_ADMIN, crear la entrada en user_roles también para el nuevo sistema
      if (requestedRole === 'DEPARTMENT_ADMIN' && normalizedDepartment) {
        console.log('[create-employee] Invitation prepared for department admin role');
      }

      console.log('[create-employee] New system preparation complete');
    } else {
      console.log('[create-employee] No migrated company found, new system will be populated when invitation is completed');
    }
  } catch (dualWriteError) {
    console.error('[create-employee] Dual write preparation failed:', dualWriteError);
    // No bloqueamos el flujo si falla el nuevo sistema
  }

  // Generate invitation URL
  const inviteUrl = `https://ai-expense-pro.vercel.app/accept-invite?token=${invitation.token}`;

  // Send invitation email via Supabase Auth
  try {
    const inviteEmailMetadata = {
      ...userMetadata,
      invitation_token: invitation.token,
      invitation_url: inviteUrl,
    };

    console.log('[create-employee] Sending invitation email to:', email);
    
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: inviteEmailMetadata,
        redirectTo: inviteUrl,
      }
    );

    if (inviteError) {
      console.error('[create-employee] Failed to send invitation email:', inviteError);
      // Don't fail the request, just log the error
    } else {
      console.log('[create-employee] Invitation email sent successfully to:', email);
    }
  } catch (emailError) {
    console.error('[create-employee] Exception sending invitation email:', emailError);
    // Don't fail the request, just log the error
  }

  return new Response(
    JSON.stringify({
      success: true,
      invitation_id: invitation.id,
      invitation_url: inviteUrl,
      message: 'invitation_created',
    }),
    {
      status: 200,
      headers: jsonHeaders,
    }
  );
});
