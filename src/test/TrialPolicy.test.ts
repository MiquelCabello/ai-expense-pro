import { describe, expect, it } from 'vitest'
import {
  formatDowngradeNotification,
  shouldTriggerTrialDowngrade,
  type DowngradeSummary,
} from '../../supabase/functions/_shared/trial-policy.ts'

describe('trial policy helpers', () => {
  it('flags Professional trials that already expired for automatic downgrade', () => {
    const reference = new Date('2024-01-31T10:00:00.000Z')
    const account = {
      plan: 'PROFESSIONAL' as const,
      status: 'TRIALING' as const,
      trial_expires_at: '2024-01-31T09:59:59.000Z',
    }

    expect(shouldTriggerTrialDowngrade(account, reference)).toBe(true)
  })

  it('keeps active trials untouched until the end date', () => {
    const reference = new Date('2024-01-30T10:00:00.000Z')
    const account = {
      plan: 'PROFESSIONAL' as const,
      status: 'TRIALING' as const,
      trial_expires_at: '2024-01-31T10:00:00.000Z',
    }

    expect(shouldTriggerTrialDowngrade(account, reference)).toBe(false)
  })

  it('builds a notification that lists plan downgrade and deleted artefacts', () => {
    const summary: DowngradeSummary = {
      removed_expenses: 12,
      removed_audit_logs: 3,
      removed_files: 8,
      removed_categories: 5,
      removed_project_codes: 2,
      inactivated_profiles: 1,
    }

    const message = formatDowngradeNotification('Acme Corp', summary)

    expect(message).toMatch(/ha pasado automáticamente al plan Free/i)
    expect(message).toMatch(/Se han eliminado 12 gastos, 8 archivos, 5 categorías, 2 proyectos, 3 registros de auditoría/i)
    expect(message).toMatch(/1 perfil adicional ha sido desactivado/i)
  })
})
