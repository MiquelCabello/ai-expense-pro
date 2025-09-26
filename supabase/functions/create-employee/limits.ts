export type AccountPlan = 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';

export type BooleanSettingKey =
  | 'can_assign_roles'
  | 'can_assign_department'
  | 'can_assign_region'
  | 'can_add_custom_categories';

export type NumericSettingKey = 'max_employees' | 'monthly_expense_limit';

export type PlanSettingKey = BooleanSettingKey | NumericSettingKey;

export type PlanSettings = {
  plan: AccountPlan;
} & {
  [K in BooleanSettingKey]: boolean;
} & {
  [K in NumericSettingKey]: number | null;
};

export type AccountLike = {
  plan?: AccountPlan | string | null;
} & Partial<Omit<PlanSettings, 'plan'>>;

export const PLAN_DEFAULTS: Record<AccountPlan, PlanSettings> = {
  FREE: {
    plan: 'FREE',
    max_employees: 2,
    can_assign_roles: false,
    can_assign_department: false,
    can_assign_region: false,
    can_add_custom_categories: false,
    monthly_expense_limit: 50,
  },
  PROFESSIONAL: {
    plan: 'PROFESSIONAL',
    max_employees: 25,
    can_assign_roles: true,
    can_assign_department: true,
    can_assign_region: true,
    can_add_custom_categories: true,
    monthly_expense_limit: null,
  },
  ENTERPRISE: {
    plan: 'ENTERPRISE',
    max_employees: null,
    can_assign_roles: true,
    can_assign_department: true,
    can_assign_region: true,
    can_add_custom_categories: true,
    monthly_expense_limit: null,
  },
};

export const PLAN_ORDER: AccountPlan[] = ['FREE', 'PROFESSIONAL', 'ENTERPRISE'];

export function normalizePlan(plan: string | null | undefined): AccountPlan {
  if (!plan) {
    return 'FREE';
  }

  const upper = plan.toUpperCase();
  if (upper === 'PRO' || upper === 'PROFESIONAL') {
    return 'PROFESSIONAL';
  }

  if (PLAN_ORDER.includes(upper as AccountPlan)) {
    return upper as AccountPlan;
  }

  return 'FREE';
}

export type PlanInput = AccountPlan | AccountLike | null | undefined;

export function resolvePlanSettings(input: PlanInput): PlanSettings {
  if (typeof input === 'string') {
    const plan = normalizePlan(input);
    return { ...PLAN_DEFAULTS[plan] };
  }

  const plan = normalizePlan(input?.plan ?? null);
  const defaults = PLAN_DEFAULTS[plan];

  return {
    plan,
    max_employees:
      input && 'max_employees' in input && input.max_employees !== undefined
        ? input.max_employees
        : defaults.max_employees,
    can_assign_roles:
      input && 'can_assign_roles' in input && input.can_assign_roles !== undefined
        ? Boolean(input.can_assign_roles)
        : defaults.can_assign_roles,
    can_assign_department:
      input &&
      'can_assign_department' in input &&
      input.can_assign_department !== undefined
        ? Boolean(input.can_assign_department)
        : defaults.can_assign_department,
    can_assign_region:
      input && 'can_assign_region' in input && input.can_assign_region !== undefined
        ? Boolean(input.can_assign_region)
        : defaults.can_assign_region,
    can_add_custom_categories:
      input &&
      'can_add_custom_categories' in input &&
      input.can_add_custom_categories !== undefined
        ? Boolean(input.can_add_custom_categories)
        : defaults.can_add_custom_categories,
    monthly_expense_limit:
      input &&
      'monthly_expense_limit' in input &&
      input.monthly_expense_limit !== undefined
        ? input.monthly_expense_limit
        : defaults.monthly_expense_limit,
  };
}

export function getPlanSetting<T extends PlanSettingKey>(
  input: PlanInput,
  key: T,
): PlanSettings[T] {
  const settings = resolvePlanSettings(input);
  return settings[key];
}

export function planAllows(
  input: PlanInput,
  key: BooleanSettingKey,
): boolean {
  return Boolean(getPlanSetting(input, key));
}

export function getNumericLimit(
  input: PlanInput,
  key: NumericSettingKey,
): number | null {
  const value = getPlanSetting(input, key);
  return typeof value === 'number' || value === null ? value : null;
}

export function hasReachedEmployeeLimit(
  input: PlanInput,
  activeEmployees: number | null | undefined,
): boolean {
  const maxEmployees = getNumericLimit(input, 'max_employees');
  if (typeof maxEmployees !== 'number') {
    return false;
  }

  if (typeof activeEmployees !== 'number') {
    return false;
  }

  return activeEmployees >= maxEmployees;
}

export function enforceEmployeeLimit(
  input: PlanInput,
  activeEmployees: number | null | undefined,
): void {
  if (hasReachedEmployeeLimit(input, activeEmployees)) {
    throw new Error('EMPLOYEE_LIMIT_REACHED');
  }
}

export function getMonthlyExpenseLimit(
  input: PlanInput,
): number | null {
  return getNumericLimit(input, 'monthly_expense_limit');
}
