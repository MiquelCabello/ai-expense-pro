import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

const {
  mockUnsubscribe,
  mockOnAuthStateChange,
  mockGetSession,
  mockSignOut,
  mockFrom,
  mockProfilesSelect,
  mockProfilesEq,
  mockProfilesMaybeSingle,
} = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  const mockOnAuthStateChange = vi.fn();
  const mockGetSession = vi.fn();
  const mockSignOut = vi.fn();
  const mockFrom = vi.fn();
  const mockProfilesSelect = vi.fn();
  const mockProfilesEq = vi.fn();
  const mockProfilesMaybeSingle = vi.fn();

  return {
    mockUnsubscribe,
    mockOnAuthStateChange,
    mockGetSession,
    mockSignOut,
    mockFrom,
    mockProfilesSelect,
    mockProfilesEq,
    mockProfilesMaybeSingle,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
}));

const TestConsumer = () => {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div data-testid="loading">loading</div>;
  }

  return <div data-testid="role">{profile?.role ?? 'NONE'}</div>;
};

describe('useAuth', () => {
  beforeEach(() => {
    mockUnsubscribe.mockReset();
    mockOnAuthStateChange.mockReset();
    mockGetSession.mockReset();
    mockSignOut.mockReset();
    mockFrom.mockReset();
    mockProfilesSelect.mockReset();
    mockProfilesEq.mockReset();
    mockProfilesMaybeSingle.mockReset();

    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: mockUnsubscribe,
        },
      },
    });

    const fakeUser = {
      id: 'user-123',
      email: 'employee@example.com',
      user_metadata: {},
    } as any;

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: fakeUser,
        },
      },
      error: null,
    });

    mockProfilesMaybeSingle.mockResolvedValue({
      data: {
        id: 'profile-123',
        user_id: fakeUser.id,
        name: 'Example Employee',
        role: 'EMPLOYEE',
        department: null,
        region: null,
        status: 'ACTIVE',
        account_id: null,
      },
      error: null,
    });

    mockProfilesEq.mockReturnValue({ maybeSingle: mockProfilesMaybeSingle });
    mockProfilesSelect.mockReturnValue({ eq: mockProfilesEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: mockProfilesSelect };
      }

      const mockAccountsMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockAccountsEq = vi.fn().mockReturnValue({ maybeSingle: mockAccountsMaybeSingle });

      return {
        select: vi.fn().mockReturnValue({ eq: mockAccountsEq }),
      };
    });
  });

  it('keeps employees without owner metadata as EMPLOYEE role', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const roleNode = await screen.findByTestId('role');

    expect(roleNode).toHaveTextContent('EMPLOYEE');
  });
});

