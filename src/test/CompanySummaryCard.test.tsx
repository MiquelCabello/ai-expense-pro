import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CompanySummaryCard from '@/components/CompanySummaryCard'
import type { Account, Profile } from '@/hooks/useAuth'

describe('CompanySummaryCard', () => {
  const account: Account = {
    id: '1234567890abcdef',
    name: 'Acme Corp',
    plan: 'PROFESSIONAL',
    owner_user_id: 'owner-1',
    max_employees: 25,
    can_assign_roles: true,
    can_assign_department: true,
    can_assign_region: true,
    can_add_custom_categories: false,
    monthly_expense_limit: null,
  }

  const profile: Profile = {
    id: 'profile-1',
    user_id: 'user-1',
    name: 'María García',
    role: 'ADMIN',
    department: 'Finanzas',
    region: 'Madrid',
    status: 'ACTIVE',
    account_id: account.id,
  }

  it('renders plan information without exposing the account identifier', () => {
    const planDisplay = 'Plan Professional'

    render(
      <CompanySummaryCard
        account={account}
        profile={profile}
        planDisplay={planDisplay}
        activeEmployees={5}
        maxEmployees={10}
      />
    )

    expect(screen.getByText(planDisplay)).toBeInTheDocument()
    expect(screen.getByText('5/10 usuarios activos')).toBeInTheDocument()
    expect(screen.queryByText(/ID #/i)).not.toBeInTheDocument()
    expect(screen.queryByText(account.id.slice(0, 8))).not.toBeInTheDocument()
  })
})
