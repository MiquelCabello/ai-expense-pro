import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EmployeesPage from '@/pages/EmployeesPage';
import type { Account, Profile } from '@/hooks/useAuth';

const {
  mockUseAuth,
  mockFrom,
  mockSelect,
  mockOrder,
  mockEq,
} = vi.hoisted(() => {
  const mockUseAuth = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockOrder = vi.fn();
  const mockEq = vi.fn();

  return {
    mockUseAuth,
    mockFrom,
    mockSelect,
    mockOrder,
    mockEq,
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

const professionalAccount: Account = {
  id: 'account-1',
  name: 'Professional Account',
  plan: 'PROFESSIONAL',
  owner_user_id: 'owner-1',
  max_employees: 25,
  can_assign_roles: true,
  can_assign_department: true,
  can_assign_region: true,
  can_add_custom_categories: false,
  monthly_expense_limit: null,
};

const adminProfile: Profile = {
  id: 'profile-1',
  user_id: 'user-1',
  name: 'Admin User',
  role: 'ADMIN',
  department: null,
  region: null,
  status: 'ACTIVE',
  account_id: professionalAccount.id,
};

const buildAuthValue = () => ({
  account: { ...professionalAccount },
  profile: { ...adminProfile },
  isMaster: false,
  user: null,
  session: null,
  loading: false,
  signOut: vi.fn(),
});

describe('EmployeesPage role selection for Professional accounts', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockOrder.mockReset();
    mockEq.mockReset();

    mockUseAuth.mockReturnValue(buildAuthValue());

    mockFrom.mockImplementation(() => ({
      select: mockSelect,
    }));

    mockSelect.mockImplementation(() => ({
      order: mockOrder,
    }));

    mockOrder.mockImplementation(() => ({
      eq: mockEq,
    }));

    mockEq.mockResolvedValue({ data: [], error: null });
  });

  it('shows the role selector when the account can assign roles', async () => {
    render(
      <MemoryRouter initialEntries={['/empleados']}>
        <EmployeesPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockEq).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /nuevo empleado/i }));

    expect(await screen.findByText(/rol/i)).toBeInTheDocument();
    expect(screen.queryByText(/acceso estándar/i)).not.toBeInTheDocument();
  });
});
