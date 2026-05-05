import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { getTodayDate } from '@/lib/date';
import { isOffline, loadFinanceSnapshot, saveFinanceSnapshot } from '@/services/offlineFinance';
import { deleteTransaction as deleteLedgerTransaction } from '@/services/financeService';
import {
  buildCategoryLookup,
  insertTransactionReturningIdWithFallback,
  insertTransactionWithFallback,
  BUDGET_SELECT_LEGACY,
  BUDGET_SELECT_WITH_CATEGORY_ID,
  DEFAULT_FINANCE_CATEGORIES,
  DebtTrackerEntry,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceEmiPayment,
  FinanceSavingsGoal,
  FinanceTransaction,
  getMonthKey,
  isInvalidIntegerInputError,
  isMissingAnyColumnError,
  isMissingColumnError,
  isMissingTableError,
  mapAccountRow,
  mapBudgetRow,
  mapEmiPaymentRow,
  mapSavingsGoalRow,
  mapTransactionRow,
  MonthlyPlanEntry,
  parseMonthKey,
  TRANSACTION_SELECT_LEGACY,
  TRANSACTION_SELECT_WITH_CATEGORY_ID,
  TRANSACTION_SELECT_WITH_CATEGORY_ID_BASIC,
} from '@/lib/finance';

type FinanceStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

interface FinanceState {
  user: User | null;
  status: FinanceStoreStatus;
  loading: boolean;
  error: string | null;
  userId: string | null;
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
  setUser: (user: User | null) => void;
  refresh: (userId: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  deleteEmi: (id: string) => Promise<void>;
  toggleEmiPayment: (paymentId: string, isPaid: boolean, accountId?: string) => Promise<void>;
  adjustSavingsGoal: (id: string, amount: number, action: 'deposit' | 'withdraw') => Promise<void>;
  saveDebtTracker: (payload: {
    month: string;
    opening_balance: number;
    auto_paid: number;
    manual_paid: number;
    auto_borrowed: number;
    manual_borrowed: number;
    opening_balance_mode: 'auto' | 'manual';
  }) => Promise<void>;
  saveMonthlyPlan: (payload: {
    month: string;
    total_income: number;
    allocated_self: number;
    allocated_family: number;
    allocated_debt: number;
  }) => Promise<void>;
}

const currentFinanceMonth = () => {
  const date = new Date();
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

const nullableUuid = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : null);

async function syncDefaultCategories(userId: string, existingCategories: FinanceCategory[]) {
  const existingKeys = new Set(existingCategories.map((category) => `${category.type}:${category.name.toLowerCase()}`));
  const missing = DEFAULT_FINANCE_CATEGORIES.filter(
    (category) => !existingKeys.has(`${category.type}:${category.name.toLowerCase()}`),
  );

  if (missing.length > 0) {
    const payload = missing.map((category) => ({
      user_id: userId,
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
      is_default: true,
    }));

    const { error } = await supabase.from('categories').insert(payload);
    if (error && !error.message.toLowerCase().includes('duplicate')) throw error;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type, icon, color, is_default')
    .eq('user_id', userId)
    .order('name');

  if (error) throw error;
  return (data || []) as FinanceCategory[];
}

async function fetchTransactions(userId: string, categoryLookup: Map<string, FinanceCategory>) {
  let supportsCategoryIds = true;
  let response = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT_WITH_CATEGORY_ID)
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (response.error && isMissingAnyColumnError(response.error)) {
    response = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_WITH_CATEGORY_ID_BASIC)
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });
  }

  if (response.error && isMissingColumnError(response.error, 'category_id')) {
    supportsCategoryIds = false;
    response = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_LEGACY)
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });
  }

  if (response.error) throw response.error;

  return {
    supportsCategoryIds,
    transactions: (response.data || []).map((transaction) => mapTransactionRow(transaction, categoryLookup)),
  };
}

async function fetchBudgets(userId: string, categoryLookup: Map<string, FinanceCategory>) {
  const monthKey = getMonthKey();
  const { month, year } = parseMonthKey(monthKey);
  let supportsCategoryIds = true;
  let response = await supabase
    .from('budgets')
    .select(BUDGET_SELECT_WITH_CATEGORY_ID)
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .order('created_at', { ascending: false });

  if (response.error && isMissingAnyColumnError(response.error)) {
    response = await supabase
      .from('budgets')
      .select(BUDGET_SELECT_LEGACY)
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .order('created_at', { ascending: false });
  }

  if (response.error && isMissingColumnError(response.error, 'year')) {
    supportsCategoryIds = false;
    response = await supabase
      .from('budgets')
      .select('id, planned_amount, month, category_id, created_at')
      .eq('user_id', userId)
      .eq('month', monthKey)
      .order('created_at', { ascending: false });
  }

  if (response.error && (isMissingAnyColumnError(response.error) || isInvalidIntegerInputError(response.error))) {
    supportsCategoryIds = false;
    response = await supabase
      .from('budgets')
      .select('id, amount, month, year, category, color, created_at')
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .order('created_at', { ascending: false });
  }

  if (response.error) throw response.error;

  return {
    supportsCategoryIds,
    budgets: (response.data || []).map((budget) => mapBudgetRow(budget, categoryLookup)),
  };
}

function categoryIdByName(categories: FinanceCategory[], name: string, type: FinanceCategory['type']) {
  return categories.find((category) => category.type === type && category.name.toLowerCase() === name.toLowerCase())?.id || null;
}

async function createEmiTransaction(params: {
  userId: string;
  payment: FinanceEmiPayment;
  emi: Tables<'emis'>;
  accountId: string;
  categoryId: string | null;
  supportsCategoryIds: boolean;
}) {
  const amount = params.payment.principal_component + params.payment.interest_component;
  const today = getTodayDate();

  const payload = {
    user_id: params.userId,
    account_id: params.accountId,
    amount,
    type: 'debit' as const,
    category_id: params.categoryId,
    category: 'EMI',
    description: `${params.emi.name} - EMI ${params.payment.month_number}/${params.emi.total_months}`,
    transaction_date: today,
    payment_mode: 'EMI Auto',
    source_module: 'emi',
    reference_id: params.payment.id,
    spending_type: 'self',
  };

  const { data, error } = await insertTransactionReturningIdWithFallback(
    supabase,
    payload as Record<string, unknown>,
    params.supportsCategoryIds,
  );

  if (error) throw error;
  if (!data?.id) throw new Error('Failed to create EMI transaction');
  return data.id;
}

async function autoCreateDueEmiTransactions(params: {
  userId: string;
  emis: Tables<'emis'>[];
  payments: FinanceEmiPayment[];
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  supportsCategoryIds: boolean;
}) {
  const today = getTodayDate();
  const emiCategoryId = categoryIdByName(params.categories, 'EMI', 'expense');
  const activeEmis = new Map(params.emis.map((emi) => [emi.id, emi]));
  let createdAny = false;

  for (const payment of params.payments) {
    if (payment.is_paid || payment.transaction_id || payment.due_date > today) continue;

    const emi = activeEmis.get(payment.emi_id);
    if (!emi) continue;

    const autoCreate = emi.auto_create_transaction ?? false;
    const accountId = nullableUuid(emi.account_id) || params.accounts[0]?.id || null;
    if (!autoCreate || !accountId) continue;

    const transactionId = await createEmiTransaction({
      userId: params.userId,
      payment,
      emi,
      accountId,
      categoryId: emiCategoryId,
      supportsCategoryIds: params.supportsCategoryIds,
    });

    const { error } = await supabase
      .from('emi_payments')
      .update({ is_paid: true, paid_date: today, transaction_id: transactionId })
      .eq('id', payment.id);
    if (error) throw error;
    createdAny = true;
  }

  return createdAny;
}

async function fetchFinanceSnapshot(userId: string) {
  const categoryResponse = await supabase
    .from('categories')
    .select('id, name, type, icon, color, is_default')
    .eq('user_id', userId)
    .order('name');
  if (categoryResponse.error) throw categoryResponse.error;

  const categories = await syncDefaultCategories(userId, (categoryResponse.data || []) as FinanceCategory[]);
  const categoryLookup = buildCategoryLookup(categories);
  const [
    transactionResult,
    budgetResult,
    debtResponse,
    plansResponse,
    accountsResponse,
    emisResponse,
    emiPaymentsResponse,
    savingsResponse,
  ] = await Promise.all([
    fetchTransactions(userId, categoryLookup),
    fetchBudgets(userId, categoryLookup),
    supabase
      .from('debt_tracker')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .then((response) =>
        response.error && isMissingTableError(response.error, 'debt_tracker')
          ? ({ data: [], error: null } as typeof response)
          : response,
      ),
    supabase
      .from('monthly_plan')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .then((response) =>
        response.error && isMissingTableError(response.error, 'monthly_plan')
          ? ({ data: [], error: null } as typeof response)
          : response,
      ),
    supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true).order('created_at'),
    supabase.from('emis').select('*').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }),
    supabase.from('emi_payments').select('*').eq('user_id', userId).order('due_date'),
    supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);

  if (accountsResponse.error) throw accountsResponse.error;
  if (emisResponse.error) throw emisResponse.error;
  if (emiPaymentsResponse.error) throw emiPaymentsResponse.error;
  if (savingsResponse.error) throw savingsResponse.error;
  if (debtResponse.error) throw debtResponse.error;
  if (plansResponse.error) throw plansResponse.error;

  const { transactions, supportsCategoryIds: supportsTransactionCategoryIds } = transactionResult;
  const { budgets, supportsCategoryIds: supportsBudgetCategoryIds } = budgetResult;
  const accounts = (accountsResponse.data || []).map((account) => mapAccountRow(account, transactions));
  const emiPayments = (emiPaymentsResponse.data || []).map(mapEmiPaymentRow);
  const emis = (emisResponse.data || []) as Tables<'emis'>[];

  const createdDueEmiTransactions = await autoCreateDueEmiTransactions({
    userId,
    emis,
    payments: emiPayments,
    accounts,
    categories,
    supportsCategoryIds: supportsTransactionCategoryIds,
  });

  const [refreshed, refreshedEmiPaymentsResponse] = createdDueEmiTransactions
    ? await Promise.all([
        fetchTransactions(userId, categoryLookup),
        supabase
          .from('emi_payments')
          .select('*')
          .eq('user_id', userId)
          .order('due_date'),
      ])
    : [
        transactionResult,
        emiPaymentsResponse,
      ];

  if (refreshedEmiPaymentsResponse.error) throw refreshedEmiPaymentsResponse.error;

  const canonicalTransactions = refreshed.transactions;
  const canonicalAccounts = (accountsResponse.data || []).map((account) => mapAccountRow(account, canonicalTransactions));

  return {
    accounts: canonicalAccounts,
    categories,
    transactions: canonicalTransactions,
    budgets,
    emis,
    emiPayments: (refreshedEmiPaymentsResponse.data || []).map(mapEmiPaymentRow),
    savingsGoals: (savingsResponse.data || []).map((goal) => mapSavingsGoalRow(goal, canonicalTransactions)),
    debtTracker: (debtResponse.data || []) as DebtTrackerEntry[],
    monthlyPlans: (plansResponse.data || []) as MonthlyPlanEntry[],
    supportsTransactionCategoryIds: refreshed.supportsCategoryIds,
    supportsBudgetCategoryIds,
  };
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  user: null,
  status: 'idle',
  loading: false,
  error: null,
  userId: null,
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  emis: [],
  emiPayments: [],
  savingsGoals: [],
  debtTracker: [],
  monthlyPlans: [],
  supportsTransactionCategoryIds: true,
  supportsBudgetCategoryIds: true,

  setUser: (user) => set({ user, userId: user?.id ?? null }),

  refresh: async (userId: string) => {
    set({ status: 'loading', loading: true, error: null, userId });
    try {
      if (isOffline()) {
        const cachedSnapshot = loadFinanceSnapshot(userId);
        if (cachedSnapshot) {
          set({ ...cachedSnapshot, status: 'ready', loading: false, error: null, userId });
          return;
        }
      }

      const snapshot = await fetchFinanceSnapshot(userId);
      set({ ...snapshot, status: 'ready', loading: false, error: null, userId });
      saveFinanceSnapshot(userId, snapshot);
    } catch (error: any) {
      const cachedSnapshot = loadFinanceSnapshot(userId);
      if (cachedSnapshot) {
        set({
          ...cachedSnapshot,
          status: 'ready',
          loading: false,
          error: 'Showing cached data. Changes will sync when the connection is available.',
          userId,
        });
        return;
      }
      set({ status: 'error', loading: false, error: error.message || 'Failed to load finance data', userId });
      throw error;
    }
  },

  deleteTransaction: async (id: string) => {
    await deleteLedgerTransaction(id);
    const userId = get().userId;
    if (userId) await get().refresh(userId);
  },

  deleteAccount: async (id: string) => {
    const linkedTransactions = get().transactions.some((transaction) => transaction.account_id === id || transaction.to_account_id === id);
    if (linkedTransactions) {
      throw new Error('This account has linked transactions. Move or delete those transactions before deleting the account.');
    }

    const linkedGoals = get().savingsGoals.some((goal) => goal.account_id === id);
    const linkedEmis = get().emis.some((emi) => nullableUuid(emi.account_id) === id);
    if (linkedGoals || linkedEmis) {
      throw new Error('This account is linked to goals or EMIs. Reassign those modules before deleting it.');
    }

    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) throw error;
    const userId = get().userId;
    if (userId) await get().refresh(userId);
  },

  deleteBudget: async (id: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) throw error;
    const userId = get().userId;
    if (userId) await get().refresh(userId);
  },

  deleteSavingsGoal: async (id: string) => {
    const linkedTransactions = get().transactions.some(
      (transaction) => transaction.reference_id === id && (transaction.source_module === 'goal' || transaction.source_module === 'savings'),
    );
    if (linkedTransactions) {
      throw new Error('This goal has contribution transactions. Delete or reassign those transactions before deleting the goal.');
    }

    const { error } = await supabase.from('savings_goals').delete().eq('id', id);
    if (error) throw error;
    const userId = get().userId;
    if (userId) await get().refresh(userId);
  },

  deleteEmi: async (id: string) => {
    const relatedPayments = get().emiPayments.filter((payment) => payment.emi_id === id);
    const linkedTransactionIds = relatedPayments.map((payment) => payment.transaction_id).filter(Boolean) as string[];
    if (linkedTransactionIds.length > 0) {
      await supabase.from('transactions').delete().in('id', linkedTransactionIds);
    }
    await supabase.from('emi_payments').delete().eq('emi_id', id);
    const { error } = await supabase.from('emis').delete().eq('id', id);
    if (error) throw error;
    const userId = get().userId;
    if (userId) await get().refresh(userId);
  },

  toggleEmiPayment: async (paymentId: string, isPaid: boolean, accountId?: string) => {
    const { userId, emiPayments, emis, accounts, categories, supportsTransactionCategoryIds } = get();
    if (!userId) throw new Error('Not signed in');

    const payment = emiPayments.find((entry) => entry.id === paymentId);
    if (!payment) throw new Error('Payment not found');

    const emi = emis.find((entry) => entry.id === payment.emi_id);
    if (!emi) throw new Error('EMI not found');

    if (!isPaid) {
      const sourceAccountId = accountId || nullableUuid(emi.account_id) || accounts[0]?.id;
      if (!sourceAccountId) throw new Error('Please create an account first');

      const transactionId = await createEmiTransaction({
        userId,
        payment,
        emi,
        accountId: sourceAccountId,
        categoryId: categoryIdByName(categories, 'EMI', 'expense'),
        supportsCategoryIds: supportsTransactionCategoryIds,
      });

      const { error } = await supabase
        .from('emi_payments')
        .update({ is_paid: true, paid_date: getTodayDate(), transaction_id: transactionId })
        .eq('id', paymentId);
      if (error) throw error;
    } else {
      if (payment.transaction_id) {
        await supabase.from('transactions').delete().eq('id', payment.transaction_id);
      }

      const { error } = await supabase
        .from('emi_payments')
        .update({ is_paid: false, paid_date: null, transaction_id: null })
        .eq('id', paymentId);
      if (error) throw error;
    }

    await get().refresh(userId);
  },

  adjustSavingsGoal: async (id: string, amount: number, action: 'deposit' | 'withdraw') => {
    const { userId, savingsGoals, categories, supportsTransactionCategoryIds } = get();
    if (!userId) throw new Error('Not signed in');
    if (amount <= 0) throw new Error('Amount must be greater than 0');

    const goal = savingsGoals.find((entry) => entry.id === id);
    if (!goal) throw new Error('Goal not found');
    if (!goal.account_id) throw new Error('Goal is not linked to an account');
    if (action === 'withdraw' && amount > goal.current_amount) throw new Error('Withdrawal exceeds saved amount');

    const savingsCategoryId = categoryIdByName(categories, 'Savings', 'expense');
    const transactionType = action === 'deposit' ? 'credit' : 'debit';

    const { error } = await insertTransactionWithFallback(
      supabase,
      {
        user_id: userId,
        account_id: goal.account_id,
        amount,
        type: transactionType,
        category_id: savingsCategoryId,
        category: 'Savings',
        description: `${goal.name} ${action === 'deposit' ? 'contribution' : 'withdrawal'}`,
        transaction_date: getTodayDate(),
        payment_mode: 'Savings Goal',
        source_module: 'goal',
        reference_id: goal.id,
        spending_type: action === 'withdraw' ? 'self' : null,
      },
      supportsTransactionCategoryIds,
    );

    if (error) throw error;
    await get().refresh(userId);
  },

  saveDebtTracker: async (payload) => {
    const userId = get().userId;
    if (!userId) throw new Error('Not signed in');

    const paid = payload.auto_paid + payload.manual_paid;
    const borrowed = payload.auto_borrowed + payload.manual_borrowed;
    const closing = payload.opening_balance - paid + borrowed;
    const { data, error } = await supabase.from('debt_tracker').upsert({
      user_id: userId,
      month: payload.month,
      opening_balance: payload.opening_balance,
      paid_amount: paid,
      borrowed_amount: borrowed,
      auto_paid: payload.auto_paid,
      manual_paid: payload.manual_paid,
      auto_borrowed: payload.auto_borrowed,
      manual_borrowed: payload.manual_borrowed,
      opening_balance_mode: payload.opening_balance_mode,
      closing_balance: closing,
    }, { onConflict: 'user_id,month' }).select('*').single();

    if (error) throw error;
    const saved = data as DebtTrackerEntry;
    const nextDebtTracker = [
      saved,
      ...get().debtTracker.filter((entry) => entry.id !== saved.id && entry.month !== saved.month),
    ].sort((left, right) => right.month.localeCompare(left.month));
    set({ debtTracker: nextDebtTracker });
  },

  saveMonthlyPlan: async (payload) => {
    const userId = get().userId;
    if (!userId) throw new Error('Not signed in');

    const remaining = payload.total_income - payload.allocated_self - payload.allocated_family - payload.allocated_debt;
    const { error } = await supabase.from('monthly_plan').upsert({
      user_id: userId,
      month: payload.month,
      total_income: payload.total_income,
      allocated_self: payload.allocated_self,
      allocated_family: payload.allocated_family,
      allocated_debt: payload.allocated_debt,
      remaining_balance: remaining,
    }, { onConflict: 'user_id,month' });

    if (error) throw error;
    await get().refresh(userId);
  },
}));
