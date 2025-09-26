<<<<<<< ours
export type AccountPlan = "FREE" | "PROFESSIONAL" | "ENTERPRISE";

export type PlanSettings = {
=======
export type AccountPlan = 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';

export type PlanSettings = {
  plan: AccountPlan;
>>>>>>> theirs
  max_employees: number | null;
  can_assign_roles: boolean;
  can_assign_department: boolean;
  can_assign_region: boolean;
  can_add_custom_categories: boolean;
  monthly_expense_limit: number | null;
};

<<<<<<< ours
export type AccountLimits = PlanSettings & { plan: AccountPlan };

export const DEFAULT_PLAN: AccountPlan = "FREE";

const BASE_PLAN_SETTINGS: Record<AccountPlan, PlanSettings> = {
=======
type MaybePlan = { plan?: AccountPlan | string | null };

export type AccountLike = MaybePlan & {
  plan: AccountPlan;
  max_employees?: number | null;
  can_assign_roles?: boolean | null;
  can_assign_department?: boolean | null;
  can_assign_region?: boolean | null;
  can_add_custom_categories?: boolean | null;
  monthly_expense_limit?: number | null;
};

const KNOWN_PLANS: AccountPlan[] = ['FREE', 'PROFESSIONAL', 'ENTERPRISE'];

const PLAN_DEFAULTS: Record<AccountPlan, Omit<PlanSettings, 'plan'>> = {
>>>>>>> theirs
  FREE: {
    max_employees: 2,
    can_assign_roles: false,
    can_assign_department: false,
    can_assign_region: false,
    can_add_custom_categories: false,
    monthly_expense_limit: 50,
  },
  PROFESSIONAL: {
    max_employees: 25,
    can_assign_roles: true,
    can_assign_department: true,
    can_assign_region: true,
    can_add_custom_categories: false,
    monthly_expense_limit: null,
  },
  ENTERPRISE: {
    max_employees: null,
    can_assign_roles: true,
    can_assign_department: true,
    can_assign_region: true,
    can_add_custom_categories: true,
    monthly_expense_limit: null,
  },
};

<<<<<<< ours
const CAMEL_TO_SNAKE_MAP = {
  maxEmployees: "max_employees",
  canAssignRoles: "can_assign_roles",
  canAssignDepartment: "can_assign_department",
  canAssignRegion: "can_assign_region",
  canAddCustomCategories: "can_add_custom_categories",
  monthlyExpenseLimit: "monthly_expense_limit",
} as const satisfies Record<string, keyof PlanSettings>;

type CamelCaseKey = keyof typeof CAMEL_TO_SNAKE_MAP;

function clonePlanSettings(settings: PlanSettings): PlanSettings {
  return { ...settings };
}

export function normalizePlan(plan: string | null | undefined): AccountPlan {
  if (!plan) {
    return DEFAULT_PLAN;
  }

  const normalized = plan.trim().toUpperCase();
  if (normalized === "PROFESSIONAL" || normalized === "ENTERPRISE") {
    return normalized;
  }

  return DEFAULT_PLAN;
}

export function planSettingsFor(plan: string | null | undefined): PlanSettings {
  const resolvedPlan = normalizePlan(plan);
  return clonePlanSettings(BASE_PLAN_SETTINGS[resolvedPlan]);
}

type AccountLike = Partial<PlanSettings> &
  Partial<Record<CamelCaseKey, PlanSettings[keyof PlanSettings]>> & {
    plan?: string | null;
  };

function extractValue<T extends keyof PlanSettings>(
  account: AccountLike | PlanSettings | null | undefined,
  key: T,
): PlanSettings[T] {
  if (!account) {
    return undefined as PlanSettings[T];
  }

  if (key in (account as PlanSettings)) {
    return (account as PlanSettings)[key];
  }

  const camelKey = (Object.keys(CAMEL_TO_SNAKE_MAP) as CamelCaseKey[]).find(
    (candidate) => CAMEL_TO_SNAKE_MAP[candidate] === key,
  );

  if (camelKey && camelKey in account) {
    return account[camelKey as CamelCaseKey] as PlanSettings[T];
  }

  return undefined as PlanSettings[T];
}

export function resolveAccountLimits(
  account: AccountLike | PlanSettings | string | null | undefined,
  fallbackPlan?: string | null,
): AccountLimits {
  const planFromAccount =
    typeof account === "string" || account === null || account === undefined
      ? account
      : account.plan;

  const plan = normalizePlan(planFromAccount ?? fallbackPlan);
  const defaults = BASE_PLAN_SETTINGS[plan];

  const candidate =
    typeof account === "string" || account === null || account === undefined
      ? null
      : account;

  return {
    plan,
    max_employees: extractValue(candidate, "max_employees") ??
      defaults.max_employees,
    can_assign_roles: extractValue(candidate, "can_assign_roles") ??
      defaults.can_assign_roles,
    can_assign_department: extractValue(candidate, "can_assign_department") ??
      defaults.can_assign_department,
    can_assign_region: extractValue(candidate, "can_assign_region") ??
      defaults.can_assign_region,
    can_add_custom_categories: extractValue(candidate, "can_add_custom_categories") ??
      defaults.can_add_custom_categories,
    monthly_expense_limit: extractValue(candidate, "monthly_expense_limit") ??
      defaults.monthly_expense_limit,
  };
}

export function hasReachedEmployeeLimit(
  activeCount: number | null | undefined,
  account?: AccountLike | PlanSettings | string | null,
): boolean {
  if (typeof activeCount !== "number" || activeCount < 0) {
    return false;
  }

  const limits = resolveAccountLimits(account);
  if (typeof limits.max_employees !== "number") {
    return false;
  }

  return activeCount >= limits.max_employees;
}

export function toCamelCaseLimits(limits: AccountLimits): {
  plan: AccountPlan;
  maxEmployees: number | null;
  canAssignRoles: boolean;
  canAssignDepartment: boolean;
  canAssignRegion: boolean;
  canAddCustomCategories: boolean;
  monthlyExpenseLimit: number | null;
} {
  return {
    plan: limits.plan,
    maxEmployees: limits.max_employees,
    canAssignRoles: limits.can_assign_roles,
    canAssignDepartment: limits.can_assign_department,
    canAssignRegion: limits.can_assign_region,
    canAddCustomCategories: limits.can_add_custom_categories,
    monthlyExpenseLimit: limits.monthly_expense_limit,
  };
}

export const PLAN_SETTINGS = {
  DEFAULT_PLAN,
  BASE_PLAN_SETTINGS,
};

export default {
  DEFAULT_PLAN,
  PLAN_SETTINGS,
  normalizePlan,
  planSettingsFor,
  resolveAccountLimits,
  hasReachedEmployeeLimit,
  toCamelCaseLimits,
};
=======
type PlanSettingKey = Exclude<keyof PlanSettings, 'plan'>;

const PLAN_SETTING_KEYS: PlanSettingKey[] = [
  'max_employees',
  'can_assign_roles',
  'can_assign_department',
  'can_assign_region',
  'can_add_custom_categories',
  'monthly_expense_limit',
];

const normalizePlan = (rawPlan: string | AccountPlan | null | undefined): AccountPlan => {
  if (typeof rawPlan === 'string') {
    const normalized = rawPlan.toUpperCase() as AccountPlan;
    if (KNOWN_PLANS.includes(normalized)) {
      return normalized;
    }
  }
  return 'FREE';
};

const cloneDefaults = (plan: AccountPlan): PlanSettings => ({
  plan,
  ...PLAN_DEFAULTS[plan],
});

const hasValue = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

export const resolvePlanSettings = (
  subject: (Partial<AccountLike> & MaybePlan) | PlanSettings | null | undefined,
  options?: {
    fallbackPlan?: AccountPlan | string | null;
    overrides?: Partial<PlanSettings>;
  },
): PlanSettings => {
  const fallbackPlan = normalizePlan(options?.fallbackPlan ?? null);
  const plan = normalizePlan(subject?.plan ?? fallbackPlan);
  const defaults = cloneDefaults(plan);
  const settings: PlanSettings = { ...defaults };

  const applySetting = <K extends PlanSettingKey>(key: K) => {
    const overrideValue = options?.overrides?.[key];
    if (overrideValue !== undefined) {
      settings[key] = overrideValue as PlanSettings[K];
      return;
    }

    const subjectValue = subject ? (subject as Partial<PlanSettings>)[key] : undefined;
    if (hasValue(subjectValue)) {
      settings[key] = subjectValue as PlanSettings[K];
      return;
    }

    settings[key] = defaults[key];
  };

  PLAN_SETTING_KEYS.forEach((key) => applySetting(key));

  return settings;
};

export const hasReachedEmployeeLimit = (
  subject: (Partial<AccountLike> & MaybePlan) | PlanSettings | null | undefined,
  currentActiveEmployees: number,
  options?: {
    fallbackPlan?: AccountPlan | string | null;
    overrides?: Partial<PlanSettings>;
  },
): boolean => {
  const settings = resolvePlanSettings(subject, options);
  const maxEmployees = settings.max_employees;
  if (!hasValue(maxEmployees)) {
    return false;
  }
  return currentActiveEmployees >= maxEmployees;
};

export const canAssignRole = (
  subject: (Partial<AccountLike> & MaybePlan) | PlanSettings | null | undefined,
  options?: {
    fallbackPlan?: AccountPlan | string | null;
    overrides?: Partial<PlanSettings>;
  },
): boolean => resolvePlanSettings(subject, options).can_assign_roles;

export const canAssignDepartment = (
  subject: (Partial<AccountLike> & MaybePlan) | PlanSettings | null | undefined,
  options?: {
    fallbackPlan?: AccountPlan | string | null;
    overrides?: Partial<PlanSettings>;
  },
): boolean => resolvePlanSettings(subject, options).can_assign_department;

export const canAssignRegion = (
  subject: (Partial<AccountLike> & MaybePlan) | PlanSettings | null | undefined,
  options?: {
    fallbackPlan?: AccountPlan | string | null;
    overrides?: Partial<PlanSettings>;
  },
): boolean => resolvePlanSettings(subject, options).can_assign_region;

export const canAddCustomCategories = (
  subject: (Partial<AccountLike> & MaybePlan) | PlanSettings | null | undefined,
  options?: {
    fallbackPlan?: AccountPlan | string | null;
    overrides?: Partial<PlanSettings>;
  },
): boolean => resolvePlanSettings(subject, options).can_add_custom_categories;

export const getMonthlyExpenseLimit = (
  subject: (Partial<AccountLike> & MaybePlan) | PlanSettings | null | undefined,
  options?: {
    fallbackPlan?: AccountPlan | string | null;
    overrides?: Partial<PlanSettings>;
  },
): number | null => resolvePlanSettings(subject, options).monthly_expense_limit;
>>>>>>> theirs
