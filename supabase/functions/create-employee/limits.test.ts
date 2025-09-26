import { describe, expect, it } from 'vitest';
import {
  PROFESSIONAL_ADDITIONAL_ADMIN_LIMIT,
  ENTERPRISE_GLOBAL_ADMIN_LIMIT,
  canInviteAdditionalAdmin,
  resolveAdminInviteLimit,
} from './limits';

describe('resolveAdminInviteLimit', () => {
  it('allows up to two additional admins for professional plans', () => {
    const account = {
      plan: 'PROFESSIONAL',
      can_assign_roles: true,
    } as const;

    expect(resolveAdminInviteLimit(account)).toBe(PROFESSIONAL_ADDITIONAL_ADMIN_LIMIT);
    expect(canInviteAdditionalAdmin(account, 0)).toBe(true);
    expect(canInviteAdditionalAdmin(account, 1)).toBe(true);
    expect(canInviteAdditionalAdmin(account, PROFESSIONAL_ADDITIONAL_ADMIN_LIMIT)).toBe(false);
  });

  it('rejects admin invites when the limit is zero or roles cannot be assigned', () => {
    const disabledAccount = {
      plan: 'PROFESSIONAL',
      can_assign_roles: false,
    } as const;

    expect(resolveAdminInviteLimit(disabledAccount)).toBe(0);
    expect(canInviteAdditionalAdmin(disabledAccount, 0)).toBe(false);
  });

  it('uses the configured enterprise quota when available', () => {
    const configuredAccount = {
      plan: 'ENTERPRISE',
      can_assign_roles: true,
      global_admin_limit: 5,
    } as const;

    expect(resolveAdminInviteLimit(configuredAccount)).toBe(5);
    expect(canInviteAdditionalAdmin(configuredAccount, 4)).toBe(true);
    expect(canInviteAdditionalAdmin(configuredAccount, 5)).toBe(false);
  });

  it('falls back to the enterprise default quota when not configured', () => {
    const defaultEnterprise = {
      plan: 'ENTERPRISE',
      can_assign_roles: true,
    } as const;

    expect(resolveAdminInviteLimit(defaultEnterprise)).toBe(ENTERPRISE_GLOBAL_ADMIN_LIMIT);
  });
});
