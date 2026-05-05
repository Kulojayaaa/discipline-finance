import { addMonths, format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import {
  computeBudgetUsage,
  FinanceBudget,
  FinanceTransaction,
  FinanceTransactionType,
  insertTransactionReturningIdWithFallback,
  updateTransactionWithFallback,
} from '@/lib/finance';

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
};

export interface TransactionInput {
  userId: string;
  accountId: string;
  categoryId: string | null;
  categoryName: string;
  type: FinanceTransactionType;
  amount: number;
  date: string;
  notes?: string | null;
  paymentMode?: string | null;
  transferAccountId?: string | null;
  spendingType?: 'self' | 'family' | null;
  sourceModule?: 'manual' | 'emi' | 'goal' | 'transfer' | 'savings';
  referenceId?: string | null;
  supportsCategoryIds?: boolean;
}

export interface EmiInput {
  userId: string;
  accountId: string;
  name: string;
  totalAmount: number;
  interestRate: number;
  tenureMonths: number;
  startDate: string;
  dueDay: number;
  notes?: string | null;
  autoCreateTransaction?: boolean;
}

const asPositiveAmount = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  return amount;
};

const syncAccountBalances = async (accountIds: Array<string | null | undefined>) => {
  const uniqueIds = Array.from(new Set(accountIds.filter(Boolean))) as string[];
  await Promise.all(
    uniqueIds.map(async (accountId) => {
      const { error } = await (supabase as unknown as RpcClient).rpc('recalculate_account_current_balance', {
        target_account_id: accountId,
      });
      if (error && !error.message.toLowerCase().includes('function')) throw error;
    }),
  );
};

const transactionPayload = (input: TransactionInput, override?: Partial<TransactionInput>) => {
  const merged = { ...input, ...override };
  const referenceType = merged.sourceModule === 'savings' ? 'goal' : merged.sourceModule || 'manual';

  return {
    user_id: merged.userId,
    account_id: merged.accountId,
    amount: asPositiveAmount(Number(merged.amount)),
    type: merged.type,
    category_id: merged.categoryId,
    category: merged.categoryName,
    description: merged.notes || null,
    payment_mode: merged.paymentMode || null,
    transaction_date: merged.date,
    to_account_id: merged.type === 'transfer' ? merged.transferAccountId : null,
    transfer_account_id: merged.type === 'transfer' ? merged.transferAccountId : null,
    spending_type: merged.type === 'debit' ? merged.spendingType || 'self' : null,
    source_module: merged.sourceModule || 'manual',
    reference_type: referenceType,
    reference_id: merged.referenceId || null,
  };
};

export async function addTransaction(input: TransactionInput) {
  if (input.type === 'transfer') return createTransfer(input);

  const { data, error } = await insertTransactionReturningIdWithFallback(
    supabase,
    transactionPayload(input),
    input.supportsCategoryIds ?? true,
  );
  if (error) throw error;

  await syncAccountBalances([input.accountId]);
  return data?.id ?? null;
}

export async function createTransfer(input: TransactionInput) {
  if (!input.transferAccountId) throw new Error('Destination account is required');
  if (input.accountId === input.transferAccountId) throw new Error('Choose two different accounts for a transfer');

  const referenceId = input.referenceId || crypto.randomUUID();
  const supportsCategoryIds = input.supportsCategoryIds ?? true;
  const common = {
    ...input,
    sourceModule: 'transfer' as const,
    referenceId,
    categoryName: input.categoryName || 'Transfer',
    spendingType: 'self' as const,
  };

  const source = transactionPayload(common, {
    type: 'debit',
    accountId: input.accountId,
    transferAccountId: null,
    notes: input.notes || `Transfer to account`,
  });
  const destination = transactionPayload(common, {
    type: 'credit',
    accountId: input.transferAccountId,
    transferAccountId: null,
    notes: input.notes || `Transfer from account`,
  });

  const first = await insertTransactionReturningIdWithFallback(supabase, source, supportsCategoryIds);
  if (first.error) throw first.error;

  const second = await insertTransactionReturningIdWithFallback(supabase, destination, supportsCategoryIds);
  if (second.error) {
    await supabase.from('transactions').delete().eq('id', first.data?.id || '');
    throw second.error;
  }

  await syncAccountBalances([input.accountId, input.transferAccountId]);
  return { referenceId, debitTransactionId: first.data?.id ?? null, creditTransactionId: second.data?.id ?? null };
}

export async function updateTransaction(id: string, input: TransactionInput) {
  const { data: previous, error: fetchError } = await supabase
    .from('transactions')
    .select('id, account_id, to_account_id, reference_id, source_module, type')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;

  const previousAccounts = [previous.account_id, previous.to_account_id];
  const isTransferGroup = previous.source_module === 'transfer' && previous.reference_id;

  if (input.type === 'transfer' || isTransferGroup) {
    await deleteTransaction(id);
    return addTransaction(input);
  }

  const { error } = await updateTransactionWithFallback(
    supabase,
    id,
    transactionPayload(input),
    input.supportsCategoryIds ?? true,
  );
  if (error) throw error;

  await syncAccountBalances([...previousAccounts, input.accountId, input.transferAccountId]);
  return id;
}

export async function deleteTransaction(id: string) {
  const { data: previous, error: fetchError } = await supabase
    .from('transactions')
    .select('id, user_id, account_id, to_account_id, reference_id, source_module')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;

  if (previous.source_module === 'transfer' && previous.reference_id) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', previous.user_id)
      .eq('reference_id', previous.reference_id)
      .eq('source_module', 'transfer');
    if (error) throw error;
  } else {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  }

  await syncAccountBalances([previous.account_id, previous.to_account_id]);
}

export function calculateBudgetActualSpent(budget: FinanceBudget, transactions: FinanceTransaction[]) {
  const usage = computeBudgetUsage(budget, transactions);
  return {
    actualSpent: usage.used,
    remaining: usage.remaining,
    usagePercent: usage.usagePercent,
    limitAmount: usage.budgeted,
  };
}

export function calculateEmiAmount(totalAmount: number, interestRate: number, tenureMonths: number) {
  asPositiveAmount(totalAmount);
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) throw new Error('Tenure must be at least 1 month');
  if (interestRate < 0) throw new Error('Interest rate cannot be negative');
  if (interestRate === 0) return totalAmount / tenureMonths;

  const monthlyRate = interestRate / 12 / 100;
  return (totalAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
}

export async function createEmiWithSchedule(input: EmiInput) {
  const emiAmount = calculateEmiAmount(input.totalAmount, input.interestRate, input.tenureMonths);

  const { data: emi, error: emiError } = await supabase
    .from('emis')
    .insert({
      user_id: input.userId,
      name: input.name,
      principal_amount: input.totalAmount,
      total_amount: input.totalAmount,
      interest_rate: input.interestRate,
      interest: input.interestRate,
      total_months: input.tenureMonths,
      tenure_months: input.tenureMonths,
      emi_amount: emiAmount,
      monthly_amount: emiAmount,
      start_date: input.startDate,
      due_date: input.startDate,
      due_day: input.dueDay,
      notes: input.notes || null,
      account_id: input.accountId,
      auto_create_transaction: input.autoCreateTransaction ?? true,
      next_due_date: input.startDate,
    } as never)
    .select('id')
    .single();
  if (emiError) throw emiError;

  const payments = buildEmiPayments({
    emiId: emi.id,
    userId: input.userId,
    principal: input.totalAmount,
    interestRate: input.interestRate,
    tenureMonths: input.tenureMonths,
    emiAmount,
    startDate: input.startDate,
    dueDay: input.dueDay,
  });

  const { error: paymentsError } = await supabase.from('emi_payments').insert(payments as never);
  if (paymentsError) throw paymentsError;

  return emi.id;
}

export function buildEmiPayments(params: {
  emiId: string;
  userId: string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  emiAmount: number;
  startDate: string;
  dueDay: number;
}) {
  const monthlyRate = params.interestRate / 12 / 100;
  let remainingPrincipal = params.principal;

  return Array.from({ length: params.tenureMonths }, (_, index) => {
    const interestComponent = remainingPrincipal * monthlyRate;
    const principalComponent = params.emiAmount - interestComponent;
    remainingPrincipal = Math.max(remainingPrincipal - principalComponent, 0);

    const dueDate = addMonths(new Date(`${params.startDate}T00:00:00`), index);
    dueDate.setDate(Math.min(Math.max(params.dueDay, 1), 28));

    return {
      emi_id: params.emiId,
      user_id: params.userId,
      month_number: index + 1,
      due_date: format(dueDate, 'yyyy-MM-dd'),
      principal_component: principalComponent,
      interest_component: interestComponent,
      is_paid: false,
      status: 'pending',
    };
  });
}

export async function markEmiPaymentPaid(paymentId: string, paid: boolean, paidDate = format(new Date(), 'yyyy-MM-dd')) {
  const { error } = await supabase
    .from('emi_payments')
    .update({
      is_paid: paid,
      paid_date: paid ? paidDate : null,
      status: paid ? 'paid' : 'pending',
    } as never)
    .eq('id', paymentId);
  if (error) throw error;
}

export async function addGoalContribution(params: {
  userId: string;
  goalId: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  date: string;
  supportsCategoryIds?: boolean;
}) {
  const transactionId = await addTransaction({
    userId: params.userId,
    accountId: params.accountId,
    categoryId: params.categoryId,
    categoryName: 'Savings',
    type: 'credit',
    amount: params.amount,
    date: params.date,
    notes: 'Savings goal contribution',
    paymentMode: 'Savings Goal',
    sourceModule: 'goal',
    referenceId: params.goalId,
    supportsCategoryIds: params.supportsCategoryIds,
  });

  const { error } = await supabase.from('goal_contributions').insert({
    user_id: params.userId,
    goal_id: params.goalId,
    transaction_id: transactionId,
    amount: params.amount,
  } as never);
  if (error && !error.message.toLowerCase().includes('goal_contributions')) throw error;

  return transactionId;
}
