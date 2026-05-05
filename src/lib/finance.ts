import { differenceInCalendarDays, endOfMonth, format, startOfMonth } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

export type FinanceTransactionType = 'credit' | 'debit' | 'transfer';
export type SpendingType = 'self' | 'family';
export type FinanceCategoryType = 'income' | 'expense';
export type FinanceReferenceType = 'manual' | 'emi' | 'goal' | 'transfer' | 'savings';

export const TRANSACTION_SELECT_WITH_CATEGORY_ID =
  'id, amount, type, category, category_id, account_id, to_account_id, payment_mode, transaction_date, description, source_module, reference_id, spending_type, created_at';
export const TRANSACTION_SELECT_WITH_CATEGORY_ID_BASIC =
  'id, amount, type, category, category_id, account_id, to_account_id, payment_mode, transaction_date, description, created_at';
export const TRANSACTION_SELECT_LEGACY =
  'id, amount, type, category, account_id, to_account_id, payment_mode, transaction_date, description, created_at';
export const BUDGET_SELECT_WITH_CATEGORY_ID = 'id, planned_amount, amount, monthly_limit, limit_amount, month, month_key, year, type, carry_forward, rollover_amount, color, category, category_id, created_at';
export const BUDGET_SELECT_LEGACY = 'id, planned_amount, amount, monthly_limit, limit_amount, month, year, type, carry_forward, rollover_amount, color, category, category_id, created_at';

export interface FinanceCategory {
  id: string;
  name: string;
  type: FinanceCategoryType;
  icon: string | null;
  color: string | null;
  is_default?: boolean | null;
}

export interface FinanceAccount {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  is_active?: boolean | null;
  initial_balance?: number | null;
  legacy_balance?: number | null;
  computed_balance: number;
  created_at?: string;
}

export interface FinanceTransaction {
  id: string;
  amount: number;
  type: FinanceTransactionType;
  category_id: string | null;
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
  account_id: string;
  to_account_id: string | null;
  payment_mode: string | null;
  transaction_date: string;
  description: string | null;
  source_module: FinanceReferenceType | null;
  reference_id: string | null;
  spending_type: SpendingType | null;
  created_at: string;
}

export interface FinanceBudget {
  id: string;
  amount: number;
  month: number;
  year: number;
  type: SpendingType;
  carry_forward: boolean;
  rollover_amount: number;
  alertThreshold: number;
  color: string | null;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
}

export interface FinanceSavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  /**
   * Derived from transactions with reference_type/source_module = goal.
   * Kept as current_amount for UI compatibility with the existing components.
   */
  current_amount: number;
  deadline: string | null;
  account_id: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
}

export interface FinanceEmiPayment {
  id: string;
  emi_id: string;
  month_number: number;
  due_date: string;
  principal_component: number;
  interest_component: number;
  is_paid: boolean;
  paid_date: string | null;
  transaction_id: string | null;
}

export function isGoalReference(transaction: Pick<FinanceTransaction, 'source_module' | 'reference_id'>, goalId: string) {
  return transaction.reference_id === goalId && (transaction.source_module === 'goal' || transaction.source_module === 'savings');
}

export interface DebtTrackerEntry {
  id: string;
  month: string;
  opening_balance: number;
  paid_amount: number;
  borrowed_amount: number;
  auto_paid: number;
  manual_paid: number;
  auto_borrowed: number;
  manual_borrowed: number;
  opening_balance_mode: 'auto' | 'manual';
  closing_balance: number;
}

export interface MonthlyPlanEntry {
  id: string;
  month: string;
  total_income: number;
  allocated_self: number;
  allocated_family: number;
  allocated_debt: number;
  remaining_balance: number;
}

export const DEFAULT_FINANCE_CATEGORIES: Array<{
  name: string;
  type: FinanceCategoryType;
  icon: string;
  color: string;
}> = [
  { name: 'Salary', type: 'income', icon: 'Rs', color: '#16A34A' },
  { name: 'Freelance', type: 'income', icon: 'Fx', color: '#0284C7' },
  { name: 'Investment', type: 'income', icon: 'Iv', color: '#7C3AED' },
  { name: 'Gift', type: 'income', icon: 'Gt', color: '#DB2777' },
  { name: 'Refund', type: 'income', icon: 'Rf', color: '#0F766E' },
  { name: 'Other Income', type: 'income', icon: 'Oi', color: '#4B5563' },
  { name: 'Food & Dining', type: 'expense', icon: 'Fd', color: '#F97316' },
  { name: 'Transportation', type: 'expense', icon: 'Tr', color: '#2563EB' },
  { name: 'Utilities', type: 'expense', icon: 'Ut', color: '#EAB308' },
  { name: 'Entertainment', type: 'expense', icon: 'En', color: '#EC4899' },
  { name: 'Shopping', type: 'expense', icon: 'Sh', color: '#8B5CF6' },
  { name: 'Health', type: 'expense', icon: 'He', color: '#EF4444' },
  { name: 'Education', type: 'expense', icon: 'Ed', color: '#14B8A6' },
  { name: 'Rent', type: 'expense', icon: 'Re', color: '#6D28D9' },
  { name: 'Insurance', type: 'expense', icon: 'In', color: '#0EA5E9' },
  { name: 'Subscriptions', type: 'expense', icon: 'Sb', color: '#6366F1' },
  { name: 'Bills', type: 'expense', icon: 'Bl', color: '#DC2626' },
  { name: 'EMI', type: 'expense', icon: 'Em', color: '#B91C1C' },
  { name: 'Savings', type: 'expense', icon: 'Sv', color: '#059669' },
  { name: 'Transfer', type: 'expense', icon: 'Tf', color: '#2563EB' },
  { name: 'Debt Payment', type: 'expense', icon: 'Dp', color: '#7C2D12' },
  { name: 'Borrowed', type: 'income', icon: 'Br', color: '#9333EA' },
  { name: 'Other Expense', type: 'expense', icon: 'Ot', color: '#6B7280' },
];

export function normalizeCategoryName(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

export function buildCategoryLookup(categories: FinanceCategory[]) {
  return new Map(categories.map((category) => [category.id, category]));
}

export function isMissingColumnError(error: { message?: string; details?: string } | null | undefined, columnName: string) {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes(columnName.toLowerCase()) && (text.includes('does not exist') || text.includes('could not find'));
}

export function isMissingAnyColumnError(error: { message?: string; details?: string } | null | undefined) {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('column') && (text.includes('does not exist') || text.includes('could not find'));
}

export function isInvalidIntegerInputError(error: { message?: string; details?: string } | null | undefined) {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('invalid input syntax for type integer');
}

export function isMissingTableError(error: { message?: string; details?: string } | null | undefined, tableName: string) {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes(tableName.toLowerCase()) && (text.includes('does not exist') || text.includes('could not find'));
}

export function findCategoryByName(categories: FinanceCategory[], name: string | null | undefined, type?: FinanceCategoryType) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return undefined;

  return categories.find(
    (category) => normalizeCategoryName(category.name) === normalized && (!type || category.type === type),
  );
}

export function buildTransactionPayload<T extends Record<string, unknown>>(
  payload: T,
  supportsCategoryIds: boolean,
) {
  if (supportsCategoryIds) return payload;

  const { category_id: _categoryId, ...legacyPayload } = payload;
  return legacyPayload;
}

/**
 * Extract a missing column name from PostgREST / Postgres errors (schema cache, unknown column).
 */
export function extractMissingColumnFromPostgrestError(
  error: { message?: string; details?: string } | null | undefined,
): string | null {
  const text = `${error?.message || ''} ${error?.details || ''}`;
  const schemaCache = text.match(/Could not find the '([^']+)' column/i);
  if (schemaCache) return schemaCache[1];
  const ofTable = text.match(/'([^']+)' column of '/i);
  if (ofTable) return ofTable[1];
  const quoted = text.match(/column "([^"]+)"/i);
  if (quoted) return quoted[1];
  const bare = text.match(/column ([a-zA-Z0-9_]+) does not exist/i);
  return bare?.[1] ?? null;
}

const MAX_TX_LEGACY_RETRIES = 16;

/**
 * Insert a transaction row, stripping unknown columns one-by-one when the DB schema is behind the app.
 */
export async function insertTransactionWithFallback(
  client: SupabaseClient,
  payload: Record<string, unknown>,
  supportsCategoryIds: boolean,
): Promise<{ error: { message: string } | null }> {
  let current: Record<string, unknown> = {
    ...(buildTransactionPayload(payload as Record<string, unknown> & object, supportsCategoryIds) as Record<string, unknown>),
  };

  for (let attempt = 0; attempt < MAX_TX_LEGACY_RETRIES; attempt += 1) {
    const { error } = await client.from('transactions').insert(current);
    if (!error) return { error: null };

    const column = extractMissingColumnFromPostgrestError(error);
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      const next = { ...current };
      delete next[column];
      current = next;
      continue;
    }

    return { error };
  }

  return { error: { message: 'Too many missing-column retries when inserting transaction' } };
}

/**
 * Insert and return `id` (for EMI auto-posting, etc.).
 */
export async function insertTransactionReturningIdWithFallback(
  client: SupabaseClient,
  payload: Record<string, unknown>,
  supportsCategoryIds: boolean,
): Promise<{ data: { id: string } | null; error: { message: string } | null }> {
  let current: Record<string, unknown> = {
    ...(buildTransactionPayload(payload as Record<string, unknown> & object, supportsCategoryIds) as Record<string, unknown>),
  };

  for (let attempt = 0; attempt < MAX_TX_LEGACY_RETRIES; attempt += 1) {
    const { data, error } = await client.from('transactions').insert(current).select('id').single();
    if (!error && data?.id) return { data: data as { id: string }, error: null };

    const column = extractMissingColumnFromPostgrestError(error);
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      const next = { ...current };
      delete next[column];
      current = next;
      continue;
    }

    return { data: null, error: error || { message: 'Insert failed' } };
  }

  return { data: null, error: { message: 'Too many missing-column retries when inserting transaction' } };
}

/**
 * Update a transaction with the same legacy fallback behavior as inserts.
 */
export async function updateTransactionWithFallback(
  client: SupabaseClient,
  transactionId: string,
  payload: Record<string, unknown>,
  supportsCategoryIds: boolean,
): Promise<{ error: { message: string } | null }> {
  let current: Record<string, unknown> = {
    ...(buildTransactionPayload(payload as Record<string, unknown> & object, supportsCategoryIds) as Record<string, unknown>),
  };

  for (let attempt = 0; attempt < MAX_TX_LEGACY_RETRIES; attempt += 1) {
    const { error } = await client.from('transactions').update(current).eq('id', transactionId);
    if (!error) return { error: null };

    const column = extractMissingColumnFromPostgrestError(error);
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      const next = { ...current };
      delete next[column];
      current = next;
      continue;
    }

    return { error };
  }

  return { error: { message: 'Too many missing-column retries when updating transaction' } };
}

export function getCategoryLabel(categoryId: string | null, categoryLookup: Map<string, FinanceCategory>, fallback?: string | null) {
  if (categoryId) {
    const match = categoryLookup.get(categoryId);
    if (match) return match.name;
  }

  return fallback || 'Transfer';
}

export function getCategoryVisuals(categoryId: string | null, categoryLookup: Map<string, FinanceCategory>) {
  if (!categoryId) {
    return { icon: null, color: null };
  }

  const match = categoryLookup.get(categoryId);
  return {
    icon: match?.icon || null,
    color: match?.color || null,
  };
}

export function mapTransactionRow(
  transaction: any,
  categoryLookup: Map<string, FinanceCategory>,
): FinanceTransaction {
  const fallbackCategoryType = transaction.type === 'credit' ? 'income' : transaction.type === 'debit' ? 'expense' : undefined;
  const fallbackCategory = findCategoryByName(categoryLookup ? Array.from(categoryLookup.values()) : [], transaction.category, fallbackCategoryType);
  const categoryId = transaction.category_id ?? fallbackCategory?.id ?? null;
  const visuals = getCategoryVisuals(categoryId, categoryLookup);
  const nestedCategory = Array.isArray(transaction.categories) ? transaction.categories[0] : transaction.categories;
  const categoryName = nestedCategory?.name || getCategoryLabel(categoryId, categoryLookup, transaction.category);

  return {
    id: transaction.id,
    amount: Number(transaction.amount || 0),
    type: transaction.type,
    category_id: categoryId,
    category_name: categoryName,
    category_icon: nestedCategory?.icon || visuals.icon,
    category_color: nestedCategory?.color || visuals.color,
    account_id: transaction.account_id,
    to_account_id: transaction.to_account_id ?? null,
    payment_mode: transaction.payment_mode ?? null,
    transaction_date: transaction.transaction_date,
    description: transaction.description ?? null,
    source_module: transaction.source_module ?? 'manual',
    reference_id: transaction.reference_id ?? null,
    spending_type: transaction.spending_type ?? null,
    created_at: transaction.created_at,
  };
}

export function mapBudgetRow(budget: any, categoryLookup: Map<string, FinanceCategory>): FinanceBudget {
  const categoryId = budget.category_id ?? null;
  const nestedCategory = Array.isArray(budget.categories) ? budget.categories[0] : budget.categories;
  const categoryName = nestedCategory?.name || getCategoryLabel(categoryId, categoryLookup, budget.category);
  const monthText = String(budget.month_key || budget.month || getMonthKey());
  const [year, month] = monthText.includes('-') ? monthText.split('-').map(Number) : [Number(budget.year || new Date().getFullYear()), Number(budget.month || 1)];

  return {
    id: budget.id,
    amount: Number(budget.planned_amount ?? budget.amount ?? 0),
    month: Number(month || 1),
    year: Number(year || new Date().getFullYear()),
    type: budget.type === 'family' ? 'family' : 'self',
    carry_forward: Boolean(budget.carry_forward),
    rollover_amount: Number(budget.rollover_amount || 0),
    alertThreshold: 80,
    color: budget.color ?? nestedCategory?.color ?? null,
    category_id: categoryId || '',
    category_name: categoryName,
    category_icon: nestedCategory?.icon || null,
    category_color: nestedCategory?.color || budget.color || null,
  };
}

export function computeGoalSavedAmount(goalId: string, transactions: FinanceTransaction[]) {
  return transactions
    .filter((transaction) => isGoalReference(transaction, goalId))
    .reduce((sum, transaction) => {
      if (transaction.type === 'credit') return sum + transaction.amount;
      if (transaction.type === 'debit') return sum - transaction.amount;
      return sum;
    }, 0);
}

export function mapSavingsGoalRow(goal: any, transactions: FinanceTransaction[] = []): FinanceSavingsGoal {
  return {
    id: goal.id,
    name: goal.name,
    target_amount: Number(goal.target_amount || 0),
    current_amount: computeGoalSavedAmount(goal.id, transactions),
    deadline: goal.deadline ?? null,
    account_id: goal.account_id ?? null,
    color: goal.color ?? null,
    icon: goal.icon ?? null,
    created_at: goal.created_at,
  };
}

export function mapEmiPaymentRow(payment: any): FinanceEmiPayment {
  return {
    id: payment.id,
    emi_id: payment.emi_id,
    month_number: Number(payment.month_number || 0),
    due_date: payment.due_date,
    principal_component: Number(payment.principal_component || 0),
    interest_component: Number(payment.interest_component || 0),
    is_paid: Boolean(payment.is_paid),
    paid_date: payment.paid_date ?? null,
    transaction_id: payment.transaction_id ?? null,
  };
}

export function computeAccountBalance(account: { id: string; initial_balance?: number | null; balance?: number | null }, transactions: FinanceTransaction[]) {
  const initialBalance = Number(account.initial_balance ?? account.balance ?? 0);

  return transactions.reduce((balance, transaction) => {
    if (transaction.account_id === account.id) {
      if (transaction.type === 'credit') return balance + transaction.amount;
      if (transaction.type === 'debit') return balance - transaction.amount;
      if (transaction.type === 'transfer') return balance - transaction.amount;
    }

    if (transaction.to_account_id === account.id && transaction.type === 'transfer') {
      return balance + transaction.amount;
    }

    return balance;
  }, initialBalance);
}

export function mapAccountRow(account: any, transactions: FinanceTransaction[]): FinanceAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    icon: account.icon ?? null,
    color: account.color ?? null,
    is_active: account.is_active ?? true,
    initial_balance: account.initial_balance ?? null,
    legacy_balance: account.balance ?? null,
    computed_balance: computeAccountBalance(account, transactions),
    created_at: account.created_at,
  };
}

export function computeSignedTransactionAmount(transaction: FinanceTransaction, neutralTransfers = false) {
  if (transaction.type === 'credit') return transaction.amount;
  if (transaction.type === 'debit') return -transaction.amount;
  if (transaction.type === 'transfer' && neutralTransfers) return 0;
  return -transaction.amount;
}

export function computeBudgetUsage(budget: FinanceBudget, transactions: FinanceTransaction[]) {
  const used = transactions
    .filter(
      (transaction) =>
        transaction.type === 'debit' &&
        transaction.category_id === budget.category_id &&
        (transaction.spending_type || 'self') === budget.type,
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const budgeted = budget.amount + (budget.carry_forward ? budget.rollover_amount : 0);
  const remaining = budgeted - used;
  const usagePercent = budgeted > 0 ? (used / budgeted) * 100 : 0;

  return { used, budgeted, remaining, usagePercent };
}

export function getBudgetSignal(usagePercent: number) {
  if (usagePercent >= 100) return 'critical';
  if (usagePercent >= 70) return 'warning';
  return 'healthy';
}

export function computeSavingsGoal(goal: FinanceSavingsGoal) {
  const remainingAmount = Math.max(goal.target_amount - goal.current_amount, 0);
  const progressPercent = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
  const isCompleted = remainingAmount <= 0;
  const daysRemaining = goal.deadline ? Math.max(differenceInCalendarDays(new Date(goal.deadline), new Date()), 0) : null;
  const monthsRemaining = goal.deadline ? Math.max(differenceInCalendarDays(new Date(goal.deadline), new Date()) / 30, 1) : null;
  const requiredMonthlySaving = monthsRemaining ? remainingAmount / monthsRemaining : 0;

  return {
    remainingAmount,
    progressPercent,
    isCompleted,
    daysRemaining,
    requiredMonthlySaving,
  };
}

export function getMonthKey(date = new Date()) {
  return format(date, 'yyyy-MM');
}

export function parseMonthKey(monthKey = getMonthKey()) {
  const [yearText, monthText] = monthKey.split('-');
  const now = new Date();
  const year = Number(yearText) || now.getFullYear();
  const month = Number(monthText) || now.getMonth() + 1;
  return {
    month: Math.min(Math.max(month, 1), 12),
    year,
  };
}

export function getMonthRange(date = new Date()) {
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  };
}

export function createMonthlyPlanDraft(existing: MonthlyPlanEntry | null, income: number) {
  if (existing) return existing;

  return {
    id: '',
    month: getMonthKey(),
    total_income: income,
    allocated_self: 0,
    allocated_family: 0,
    allocated_debt: 0,
    remaining_balance: income,
  };
}
