export type PlanTier = 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE' | string;

export interface AccountPlanCapabilities {
  plan: PlanTier;
  can_assign_roles: boolean | null | undefined;
  global_admin_limit?: number | null;
}

export const PROFESSIONAL_ADDITIONAL_ADMIN_LIMIT = 2;
export const ENTERPRISE_GLOBAL_ADMIN_LIMIT = 2;

export const resolveAdminInviteLimit = (account: AccountPlanCapabilities): number => {
  if (!account || account.can_assign_roles !== true) {
    return 0;
  }

  if (typeof account.global_admin_limit === 'number' && account.global_admin_limit >= 0) {
    return account.global_admin_limit;
  }

  const normalizedPlan = (account.plan || '').toString().toUpperCase();

  if (normalizedPlan === 'PROFESSIONAL') {
    return PROFESSIONAL_ADDITIONAL_ADMIN_LIMIT;
  }

  if (normalizedPlan === 'ENTERPRISE') {
    return ENTERPRISE_GLOBAL_ADMIN_LIMIT;
  }

  return 0;
};

export const canInviteAdditionalAdmin = (
  account: AccountPlanCapabilities,
  currentActiveAdminCount: number,
): boolean => {
  const limit = resolveAdminInviteLimit(account);

  if (limit <= 0) {
    return false;
  }

  return currentActiveAdminCount < limit;
};