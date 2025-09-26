import { describe, it, beforeEach, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import type { Session, User } from '@supabase/supabase-js';

const {
  mockSupabase,
  mockFrom,
  mockSelect,
  mockEq,
  mockMaybeSingle,
  mockGetSession,
  mockOnAuthStateChange,
  mockSignOut,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn<[], Promise<{ data: any; error: any }>>();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockGetSession = vi.fn();
  const mockOnAuthStateChange = vi.fn();
  const mockSignOut = vi.fn();
  const mockSupabase = {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
    from: mockFrom,
  } as const;

  return {
    mockSupabase,
    mockFrom,
    mockSelect,
    mockEq,
    mockMaybeSingle,
    mockGetSession,
    mockOnAuthStateChange,
    mockSignOut,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

const TestConsumer = () => {
  const { account, loading } = useAuth();

  if (loading) {
    return <div data-testid="loading">loading</div>;
  }

  return (
    <div>
      <div data-testid="account-owner">{account?.owner_user_id ?? 'none'}</div>
      <div data-testid="account-id">{account?.id ?? 'none'}</div>
    </div>
  );
};

describe('AuthProvider master account owner id handling', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockMaybeSingle.mockReset();
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockReset();
    mockSignOut.mockReset();

    mockFrom.mockImplementation(() => ({
      select: mockSelect,
    }));

    mockSelect.mockImplementation(() => ({
      eq: mockEq,
    }));

    mockEq.mockImplementation(() => ({
      maybeSingle: mockMaybeSingle,
    }));

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });

    mockSignOut.mockResolvedValue(undefined);
  });

  it('keeps the owner_user_id aligned with the master user id', async () => {
    const ownerUser = {
      id: 'owner-123',
      email: 'info@miquelcabello.com',
      user_metadata: {},
    } as User;
    const session = { user: ownerUser } as Session;

    mockGetSession.mockResolvedValue({ data: { session }, error: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    const ownerNode = await screen.findByTestId('account-owner');
    expect(ownerNode).toHaveTextContent(ownerUser.id);
  });
});
