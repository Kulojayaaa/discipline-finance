import type {
  DebtTrackerEntry,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceEmiPayment,
  FinanceSavingsGoal,
  FinanceTransaction,
  MonthlyPlanEntry,
} from '@/lib/finance';
import type { Tables } from '@/integrations/supabase/types';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'fintrack.finance.snapshot';

export interface FinanceSnapshotCache {
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  emis: Tables<'emis'>[];
  emiPayments: FinanceEmiPayment[];
  savingsGoals: FinanceSavingsGoal[];
  debtTracker: DebtTrackerEntry[];
  monthlyPlans: MonthlyPlanEntry[];
  supportsTransactionCategoryIds: boolean;
  supportsBudgetCategoryIds: boolean;
}

interface StoredFinanceSnapshot {
  version: number;
  savedAt: string;
  data: FinanceSnapshotCache;
}

const cacheKey = (userId: string) => `${CACHE_PREFIX}.${userId}`;

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function saveFinanceSnapshot(userId: string, data: FinanceSnapshotCache) {
  if (typeof localStorage === 'undefined') return;

  const payload: StoredFinanceSnapshot = {
    version: CACHE_VERSION,
    savedAt: new Date().toISOString(),
    data,
  };

  localStorage.setItem(cacheKey(userId), JSON.stringify(payload));
}

export function loadFinanceSnapshot(userId: string): FinanceSnapshotCache | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredFinanceSnapshot;
    if (parsed.version !== CACHE_VERSION) return null;

    return parsed.data;
  } catch {
    return null;
  }
}
