import { ReactNode } from 'react'
import { render, waitFor } from '@testing-library/react'
import { describe, it, beforeEach, expect, vi } from 'vitest'
import App from '@/App'

const mockSignOut = vi.fn(async () => {})

type MockAuthState = {
  account: null
  user: { id: string }
  session: null
  profile: {
    id: string
    user_id: string
    name: string
    role: 'ADMIN' | 'EMPLOYEE'
    status: 'ACTIVE' | 'INACTIVE'
  }
  loading: boolean
  isMaster: boolean
  signOut: () => Promise<void>
}

const mockAuthState: MockAuthState = {
  account: null,
  user: { id: 'user-1' },
  session: null,
  profile: {
    id: 'profile-1',
    user_id: 'user-1',
    name: 'Test User',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
  },
  loading: false,
  isMaster: false,
  signOut: mockSignOut,
}

vi.mock('@/hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => mockAuthState,
}))

vi.mock('@/pages/CompanyProfilePage', () => ({
  default: () => <div>Company Page</div>,
}))

vi.mock('@/pages/EmployeesPage', () => ({
  default: () => <div>Employees Page</div>,
}))

describe('Employees route access control', () => {
  beforeEach(() => {
    mockAuthState.profile.role = 'EMPLOYEE'
    window.history.replaceState({}, '', '/')
    mockSignOut.mockReset()
  })

  it('redirects non-admin users away from /empleados', async () => {
    window.history.pushState({}, 'Test', '/empleados')

    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/empresa')
    })
  })
})
