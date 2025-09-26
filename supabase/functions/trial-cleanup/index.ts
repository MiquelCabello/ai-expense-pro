/// <reference path="../types.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  formatDowngradeNotification,
  shouldTriggerTrialDowngrade,
  type AccountPlan,
  type AccountStatus,
  type DowngradeSummary,
} from "../_shared/trial-policy.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const jsonHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const webhookUrl = Deno.env.get("TRIAL_EXPIRATION_WEBHOOK_URL") ?? ""

interface AccountRow {
  id: string
  name: string
  plan: AccountPlan
  status: AccountStatus
  owner_user_id: string
  trial_expires_at: string | null
}

interface RpcSummary extends Partial<DowngradeSummary> {
  status?: string
}

const buildSummary = (payload: RpcSummary | null): DowngradeSummary => ({
  removed_expenses: payload?.removed_expenses ?? 0,
  removed_audit_logs: payload?.removed_audit_logs ?? 0,
  removed_files: payload?.removed_files ?? 0,
  removed_categories: payload?.removed_categories ?? 0,
  removed_project_codes: payload?.removed_project_codes ?? 0,
  inactivated_profiles: payload?.inactivated_profiles ?? 0,
})

const notifyRecipients = async (emails: string[], subject: string, message: string) => {
  if (emails.length === 0) {
    return
  }

  if (!webhookUrl) {
    console.log(`[trial-cleanup] Notificación omitida (sin webhook): ${subject} -> ${emails.join(', ')}`)
    console.log(message)
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message, recipients: emails }),
    })

    if (!response.ok) {
      console.error("[trial-cleanup] Webhook response not ok", await response.text())
    }
  } catch (error) {
    console.error("[trial-cleanup] Failed to call webhook", error)
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: jsonHeaders,
    })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "missing_service_configuration" }), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const now = new Date()
  const nowIso = now.toISOString()

  const { data: trialAccounts, error: listError } = await adminClient
    .from("accounts")
    .select("id, name, plan, status, owner_user_id, trial_expires_at")
    .eq("status", "TRIALING")
    .lte("trial_expires_at", nowIso)

  if (listError) {
    console.error("[trial-cleanup] Unable to list accounts", listError)
    return new Response(JSON.stringify({ error: "list_failed" }), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  const processed: Array<{
    account: AccountRow
    summary: DowngradeSummary
    notified: string[]
  }> = []
  const failures: Array<{ account: AccountRow; error: string }> = []

  for (const account of trialAccounts ?? []) {
    if (!shouldTriggerTrialDowngrade(account, now)) {
      continue
    }

    const { data: rpcSummary, error: downgradeError } = await adminClient.rpc<RpcSummary>(
      "downgrade_trial_account",
      {
        _account_id: account.id,
      }
    )

    if (downgradeError) {
      console.error(`[trial-cleanup] downgrade failed for ${account.id}`, downgradeError)
      failures.push({ account, error: downgradeError.message })
      continue
    }

    if (rpcSummary?.status === "not_found") {
      failures.push({ account, error: "account_not_found" })
      continue
    }

    const summary = buildSummary(rpcSummary)

    const { data: profiles, error: profileError } = await adminClient
      .from("profiles")
      .select("user_id, status")
      .eq("account_id", account.id)

    if (profileError) {
      console.error(`[trial-cleanup] profiles lookup failed for ${account.id}`, profileError)
    }

    const userIds = new Set<string>()
    userIds.add(account.owner_user_id)

    for (const profile of profiles ?? []) {
      userIds.add(profile.user_id)
    }

    const emails: string[] = []

    for (const userId of userIds) {
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId)
      if (userError) {
        console.error(`[trial-cleanup] unable to load user ${userId}`, userError)
        continue
      }

      const email = userData?.user?.email
      if (email) {
        emails.push(email)
      }
    }

    const notificationMessage = formatDowngradeNotification(account.name, summary)
    await notifyRecipients(
      emails,
      "Fin del periodo de prueba - ExpensePro",
      notificationMessage
    )

    processed.push({ account, summary, notified: emails })
  }

  return new Response(
    JSON.stringify({
      processed: processed.map((entry) => ({
        account_id: entry.account.id,
        summary: entry.summary,
        notified: entry.notified,
      })),
      failures,
    }),
    {
      status: 200,
      headers: jsonHeaders,
    }
  )
})
