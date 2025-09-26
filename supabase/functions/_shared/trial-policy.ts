export type AccountPlan = 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE'
export type AccountStatus = 'ACTIVE' | 'TRIALING' | 'SUSPENDED'

export const TRIAL_DURATION_DAYS = 30

export interface TrialAccountState {
  plan: AccountPlan
  status: AccountStatus
  trial_expires_at: string | null
}

export interface DowngradeSummary {
  removed_expenses: number
  removed_audit_logs: number
  removed_files: number
  removed_categories: number
  removed_project_codes: number
  inactivated_profiles: number
}

const pluralize = (count: number, singular: string, plural: string) => {
  return `${count} ${count === 1 ? singular : plural}`
}

export const shouldTriggerTrialDowngrade = (
  account: TrialAccountState,
  referenceDate: Date = new Date()
): boolean => {
  if (account.status !== 'TRIALING') {
    return false
  }

  if (!account.trial_expires_at) {
    return false
  }

  const expiresAt = new Date(account.trial_expires_at).getTime()
  return expiresAt <= referenceDate.getTime()
}

export const getTrialWindow = (startDate: Date) => {
  const start = new Date(startDate)
  const expires = new Date(start)
  expires.setUTCDate(expires.getUTCDate() + TRIAL_DURATION_DAYS)
  return {
    startedAtIso: start.toISOString(),
    expiresAtIso: expires.toISOString(),
  }
}

export const formatDowngradeNotification = (
  accountName: string,
  summary: DowngradeSummary
): string => {
  const lines: string[] = []
  lines.push(
    `La demo de 30 días de ${accountName} ha finalizado y la cuenta ha pasado automáticamente al plan Free.`
  )

  const removals: string[] = []

  if (summary.removed_expenses > 0) {
    removals.push(pluralize(summary.removed_expenses, 'gasto', 'gastos'))
  }

  if (summary.removed_files > 0) {
    removals.push(pluralize(summary.removed_files, 'archivo', 'archivos'))
  }

  if (summary.removed_categories > 0) {
    removals.push(pluralize(summary.removed_categories, 'categoría', 'categorías'))
  }

  if (summary.removed_project_codes > 0) {
    removals.push(pluralize(summary.removed_project_codes, 'proyecto', 'proyectos'))
  }

  if (summary.removed_audit_logs > 0) {
    removals.push(pluralize(summary.removed_audit_logs, 'registro de auditoría', 'registros de auditoría'))
  }

  if (removals.length > 0) {
    lines.push(`Se han eliminado ${removals.join(', ')} para cumplir con los límites del plan Starter.`)
  } else {
    lines.push('No fue necesario eliminar gastos ni documentos al aplicar el plan Starter.')
  }

  if (summary.inactivated_profiles > 0) {
    lines.push(
      `Además, ${pluralize(
        summary.inactivated_profiles,
        'perfil adicional ha sido desactivado',
        'perfiles adicionales han sido desactivados'
      )} para respetar el máximo de 2 usuarios del plan Free.`
    )
  }

  lines.push(
    'Si quieres conservar toda la información del periodo de prueba puedes reactivar el plan Professional en cualquier momento desde la configuración.'
  )

  return lines.join(' ')
}
