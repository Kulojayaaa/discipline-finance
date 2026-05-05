import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/CurrencyContext';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Target,
  CalendarDays,
  CalendarRange,
  Calendar as CalendarIcon,
  Search,
  BarChart2,
  PieChart as PieIcon,
  Sparkles,
  AlertTriangle,
  ArrowRightLeft,
  PiggyBank,
  Landmark,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { AddAccountDialog } from '@/components/expenses/AddAccountDialog';
import { AddTransactionDialog } from '@/components/expenses/AddTransactionDialog';
import { TransactionList } from '@/components/expenses/TransactionList';
import { AccountCard } from '@/components/expenses/AccountCard';
import { BudgetCard } from '@/components/expenses/BudgetCard';
import { AddEmiDialog } from '@/components/expenses/AddEmiDialog';
import { EmiCard } from '@/components/expenses/EmiCard';
import { AddBudgetDialog } from '@/components/expenses/AddBudgetDialog';
import { AddCategoryDialog } from '@/components/expenses/AddCategoryDialog';
import { SavingsGoalCard } from '@/components/expenses/SavingsGoalCard';
import { AddSavingsGoalDialog } from '@/components/expenses/AddSavingsGoalDialog';
import { getTodayDate, getWeekStartDate, getMonthStartDate } from '@/lib/date';
import { exportToCSV } from '@/lib/export';
import { cn } from '@/lib/utils';
import { useFinanceStore } from '@/store/financeStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  buildCategoryLookup,
  insertTransactionWithFallback,
  BUDGET_SELECT_LEGACY,
  BUDGET_SELECT_WITH_CATEGORY_ID,
  computeBudgetUsage,
  computeSavingsGoal,
  createMonthlyPlanDraft,
  DEFAULT_FINANCE_CATEGORIES,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceEmiPayment,
  FinanceSavingsGoal,
  FinanceTransaction,
  getBudgetSignal,
  isMissingAnyColumnError,
  isMissingColumnError,
  isMissingTableError,
  getMonthKey,
  mapAccountRow,
  mapBudgetRow,
  mapEmiPaymentRow,
  mapSavingsGoalRow,
  mapTransactionRow,
  MonthlyPlanEntry,
  DebtTrackerEntry,
  TRANSACTION_SELECT_LEGACY,
  TRANSACTION_SELECT_WITH_CATEGORY_ID_BASIC,
  TRANSACTION_SELECT_WITH_CATEGORY_ID,
} from '@/lib/finance';

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#F97316', '#0EA5E9', '#64748B'];
const PAGE_SIZE = 10;
const AccountReport = lazy(() => import('@/components/expenses/AccountReport').then((module) => ({ default: module.AccountReport })));

type TransactionTypeFilter = 'all' | 'credit' | 'debit' | 'transfer';
type SpendingFilter = 'all' | 'self' | 'family';
type DebtQuickAction = 'payment' | 'borrowed';
type OpeningBalanceMode = 'auto' | 'manual';

const toDateValue = (value: string) => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseMonthDate = (month: string) => {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export default function Expenses() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const {
    accounts,
    categories,
    transactions,
    budgets,
    emis,
    emiPayments,
    savingsGoals,
    debtTracker,
    monthlyPlans,
    loading,
    supportsTransactionCategoryIds,
    supportsBudgetCategoryIds,
    refresh,
    deleteTransaction: deleteTransactionFromStore,
    deleteAccount: deleteAccountFromStore,
    deleteBudget: deleteBudgetFromStore,
    deleteSavingsGoal: deleteSavingsGoalFromStore,
    deleteEmi: deleteEmiFromStore,
    toggleEmiPayment: toggleEmiPaymentFromStore,
    adjustSavingsGoal: adjustSavingsGoalFromStore,
    saveDebtTracker: saveDebtTrackerToStore,
    saveMonthlyPlan: saveMonthlyPlanToStore,
  } = useFinanceStore();

  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<TransactionTypeFilter>('all');
  const [txCategoryFilter, setTxCategoryFilter] = useState('all');
  const [txSpendingFilter, setTxSpendingFilter] = useState<SpendingFilter>('all');
  const [txFromDate, setTxFromDate] = useState('');
  const [txToDate, setTxToDate] = useState('');
  const [txPage, setTxPage] = useState(1);

  const [quickExpense, setQuickExpense] = useState({
    amount: '',
    categoryId: '',
    accountId: '',
    transactionDate: getTodayDate(),
    spendingType: 'self' as 'self' | 'family',
    description: '',
  });
  const [savingQuickExpense, setSavingQuickExpense] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<FinanceTransaction | null>(null);
  const [debtQuickAction, setDebtQuickAction] = useState<DebtQuickAction | null>(null);

  const [deletingTx, setDeletingTx] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<string | null>(null);
  const [deletingEmi, setDeletingEmi] = useState<string | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<string | null>(null);
  const [deletingSavings, setDeletingSavings] = useState<string | null>(null);

  const currentMonthDate = new Date();
  const currentMonth = currentMonthDate.getMonth() + 1;
  const currentYear = currentMonthDate.getFullYear();
  const currentMonthKey = getMonthKey(currentMonthDate);

  const [debtForm, setDebtForm] = useState({
    month: currentMonthKey,
    opening_balance: '0',
    manual_paid: '0',
    manual_borrowed: '0',
    opening_balance_mode: 'auto' as OpeningBalanceMode,
  });
  const [planForm, setPlanForm] = useState({
    month: currentMonthKey,
    total_income: '0',
    allocated_self: '0',
    allocated_family: '0',
    allocated_debt: '0',
  });

  useEffect(() => {
    if (user) {
      void fetchData();
    }
  }, [user, refresh]);

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      await refresh(user.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load finance data');
    }
  };

  useEffect(() => {
    if (accounts.length > 0) {
      setQuickExpense((current) => ({
        ...current,
        accountId: current.accountId || accounts[0].id,
      }));
    }
  }, [accounts]);

  useEffect(() => {
    const activePlan = monthlyPlans.find((plan) => plan.month === currentMonthKey) || null;
    const draft = createMonthlyPlanDraft(activePlan, 0);
    setPlanForm({
      month: draft.month,
      total_income: String(activePlan?.total_income ?? 0),
      allocated_self: String(activePlan?.allocated_self ?? 0),
      allocated_family: String(activePlan?.allocated_family ?? 0),
      allocated_debt: String(activePlan?.allocated_debt ?? 0),
    });

    const activeDebt = debtTracker.find((entry) => entry.month === currentMonthKey);
    const previousDebt = debtTracker.find((entry) => entry.month < currentMonthKey);
    const openingMode = activeDebt?.opening_balance_mode || 'auto';
    setDebtForm({
      month: activeDebt?.month || currentMonthKey,
      opening_balance: String(activeDebt?.opening_balance ?? previousDebt?.closing_balance ?? 0),
      manual_paid: String(activeDebt?.manual_paid ?? activeDebt?.paid_amount ?? 0),
      manual_borrowed: String(activeDebt?.manual_borrowed ?? activeDebt?.borrowed_amount ?? 0),
      opening_balance_mode: openingMode,
    });
  }, [currentMonthKey, debtTracker, monthlyPlans]);

  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const categoriesById = useMemo(() => buildCategoryLookup(categories), [categories]);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense').sort((left, right) => left.name.localeCompare(right.name)),
    [categories],
  );

  const today = getTodayDate();
  const weekStart = getWeekStartDate();
  const monthStart = getMonthStartDate();
  const monthTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.transaction_date >= monthStart),
    [transactions, monthStart],
  );
  const debtMonthRange = useMemo(() => {
    const date = parseMonthDate(debtForm.month);
    return {
      start: format(startOfMonth(date), 'yyyy-MM-dd'),
      end: format(endOfMonth(date), 'yyyy-MM-dd'),
    };
  }, [debtForm.month]);
  const debtMonthTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_date >= debtMonthRange.start &&
          transaction.transaction_date <= debtMonthRange.end &&
          (!transaction.spending_type || transaction.spending_type === 'self'),
      ),
    [debtMonthRange.end, debtMonthRange.start, transactions],
  );
  const autoDebtPaid = useMemo(
    () =>
      debtMonthTransactions
        .filter((transaction) => transaction.type === 'debit' && transaction.category_name.toLowerCase() === 'debt payment')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [debtMonthTransactions],
  );
  const autoDebtBorrowed = useMemo(
    () =>
      debtMonthTransactions
        .filter((transaction) => transaction.type === 'credit' && transaction.category_name.toLowerCase() === 'borrowed')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [debtMonthTransactions],
  );
  const autoOpeningBalance = useMemo(
    () => debtTracker.find((entry) => entry.month < debtForm.month)?.closing_balance ?? 0,
    [debtForm.month, debtTracker],
  );
  const debtOpeningBalance =
    debtForm.opening_balance_mode === 'auto' ? Number(autoOpeningBalance || 0) : Number(debtForm.opening_balance) || 0;
  const manualDebtPaid = Number(debtForm.manual_paid) || 0;
  const manualDebtBorrowed = Number(debtForm.manual_borrowed) || 0;
  const debtClosingBalance = debtOpeningBalance - (autoDebtPaid + manualDebtPaid) + (autoDebtBorrowed + manualDebtBorrowed);
  const showBorrowAlert = manualDebtBorrowed > 0;
  const showDebtMismatchAlert =
    (manualDebtPaid > Math.max(autoDebtPaid * 2, 0) && manualDebtPaid > 0) ||
    (manualDebtBorrowed > Math.max(autoDebtBorrowed * 2, 0) && manualDebtBorrowed > 0);

  useEffect(() => {
    if (debtForm.opening_balance_mode !== 'auto') return;
    setDebtForm((current) => ({ ...current, opening_balance: String(autoOpeningBalance) }));
  }, [autoOpeningBalance, debtForm.opening_balance_mode]);

  const todaySpending = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.type === 'debit' && transaction.transaction_date === today)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [today, transactions],
  );

  const weekSpending = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.type === 'debit' && transaction.transaction_date >= weekStart)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions, weekStart],
  );

  const totalIncome = monthTransactions
    .filter((transaction) => transaction.type === 'credit')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = monthTransactions
    .filter((transaction) => transaction.type === 'debit')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalBalance = accounts.reduce((sum, account) => sum + account.computed_balance, 0);
  const selfSpending = monthTransactions
    .filter((transaction) => transaction.type === 'debit' && transaction.spending_type === 'self')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const familySpending = monthTransactions
    .filter((transaction) => transaction.type === 'debit' && transaction.spending_type === 'family')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const transferVolume = monthTransactions
    .filter((transaction) => transaction.type === 'transfer')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalEmiOutstanding = emiPayments
    .filter((payment) => !payment.is_paid)
    .reduce((sum, payment) => sum + payment.principal_component + payment.interest_component, 0);
  const totalEmiMonthly = emis.reduce((sum, emi) => sum + Number(emi.emi_amount || 0), 0);
  const emiVsIncomePercent = totalIncome > 0 ? Math.round((totalEmiMonthly / totalIncome) * 100) : 0;

  const savingsSummaries = useMemo(
    () => savingsGoals.map((goal) => ({ goal, summary: computeSavingsGoal(goal) })),
    [savingsGoals],
  );
  const currentSavingsPlan = monthlyPlans.find((plan) => plan.month === currentMonthKey) || null;
  const latestDebt = debtTracker[0] || null;

  const budgetSummaries = useMemo(
    () =>
      budgets.map((budget) => ({
        budget,
        usage: computeBudgetUsage(budget, monthTransactions),
      })),
    [budgets, monthTransactions],
  );

  const budgetAlerts = budgetSummaries.filter(({ usage }) => usage.usagePercent >= 100);
  const budgetRemainingTotal = budgetSummaries.reduce((sum, entry) => sum + Math.max(entry.usage.remaining, 0), 0);
  const daysRemainingInMonth = Math.max(differenceInCalendarDays(endOfMonth(new Date()), new Date()) + 1, 1);
  const suggestedDailyLimit =
    (currentSavingsPlan?.remaining_balance || 0) > 0
      ? Number(currentSavingsPlan?.remaining_balance || 0) / daysRemainingInMonth
      : budgetRemainingTotal / daysRemainingInMonth;

  const disciplineAlerts = [
    ...(budgetAlerts.length > 0
      ? [
          {
            id: 'budget',
            title: 'Budget exceeded',
            body: `${budgetAlerts.map((entry) => entry.budget.category_name).join(', ')} crossed the monthly limit.`,
          },
        ]
      : []),
    ...(suggestedDailyLimit > 0 && todaySpending > suggestedDailyLimit
      ? [
          {
            id: 'daily-limit',
            title: 'Daily limit exceeded',
            body: `Today's spending ${formatCurrency(todaySpending)} is above the daily guardrail of ${formatCurrency(suggestedDailyLimit)}.`,
          },
        ]
      : []),
    ...(latestDebt && latestDebt.closing_balance > latestDebt.opening_balance
      ? [
          {
            id: 'debt',
            title: 'Debt increased',
            body: `Debt went from ${formatCurrency(Number(latestDebt.opening_balance))} to ${formatCurrency(Number(latestDebt.closing_balance))}.`,
          },
        ]
      : []),
  ];

  const categorySpending = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions
      .filter((transaction) => transaction.type === 'debit')
      .forEach((transaction) => {
        map[transaction.category_name] = (map[transaction.category_name] || 0) + transaction.amount;
      });
    return Object.entries(map).sort((left, right) => right[1] - left[1]);
  }, [monthTransactions]);

  const monthlyChartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const date = subMonths(new Date(), 5 - index);
      const start = format(startOfMonth(date), 'yyyy-MM-dd');
      const end = format(endOfMonth(date), 'yyyy-MM-dd');
      const monthlySlice = transactions.filter(
        (transaction) => transaction.transaction_date >= start && transaction.transaction_date <= end,
      );
      return {
        month: format(date, 'MMM'),
        Income: monthlySlice.filter((transaction) => transaction.type === 'credit').reduce((sum, transaction) => sum + transaction.amount, 0),
        Expenses: monthlySlice.filter((transaction) => transaction.type === 'debit').reduce((sum, transaction) => sum + transaction.amount, 0),
        Self: monthlySlice
          .filter((transaction) => transaction.type === 'debit' && transaction.spending_type === 'self')
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        Family: monthlySlice
          .filter((transaction) => transaction.type === 'debit' && transaction.spending_type === 'family')
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      };
    });
  }, [transactions]);

  const pieData = useMemo(
    () => categorySpending.slice(0, 8).map(([name, value]) => ({ name, value })),
    [categorySpending],
  );

  const filteredTransactions = useMemo(() => {
    const query = txSearch.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (txTypeFilter !== 'all' && transaction.type !== txTypeFilter) return false;
      if (txCategoryFilter !== 'all' && transaction.category_id !== txCategoryFilter) return false;
      if (txSpendingFilter !== 'all' && transaction.type === 'debit' && transaction.spending_type !== txSpendingFilter) return false;
      if (txSpendingFilter !== 'all' && transaction.type !== 'debit') return false;
      if (txFromDate && transaction.transaction_date < txFromDate) return false;
      if (txToDate && transaction.transaction_date > txToDate) return false;

      if (query) {
        const fromAccount = accountsById[transaction.account_id]?.name?.toLowerCase() || '';
        const toAccount = transaction.to_account_id ? accountsById[transaction.to_account_id]?.name?.toLowerCase() || '' : '';
        const searchBlob = [
          transaction.description?.toLowerCase() || '',
          transaction.category_name.toLowerCase(),
          fromAccount,
          toAccount,
        ].join(' ');
        return searchBlob.includes(query);
      }

      return true;
    });
  }, [
    accountsById,
    transactions,
    txCategoryFilter,
    txFromDate,
    txSearch,
    txSpendingFilter,
    txToDate,
    txTypeFilter,
  ]);

  useEffect(() => {
    setTxPage(1);
  }, [txSearch, txTypeFilter, txCategoryFilter, txSpendingFilter, txFromDate, txToDate]);

  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, txPage]);

  const totalTxPages = Math.max(Math.ceil(filteredTransactions.length / PAGE_SIZE), 1);

  const handleExport = () => {
    if (transactions.length === 0) return;

    const data = transactions.map((transaction) => ({
      Date: transaction.transaction_date,
      Type: transaction.type,
      Category: transaction.category_name,
      Amount: transaction.amount,
      SpendType: transaction.spending_type || '',
      Account: accountsById[transaction.account_id]?.name || '',
      ToAccount: transaction.to_account_id ? accountsById[transaction.to_account_id]?.name || '' : '',
      Description: transaction.description || '',
      PaymentMode: transaction.payment_mode || '',
      SourceModule: transaction.source_module || 'manual',
    }));
    exportToCSV(data, 'finance_transactions');
    toast.success('Transactions exported!');
  };

  const getCategoryId = (name: string, type: 'income' | 'expense') => {
    const match = categories.find(
      (category) => category.type === type && category.name.toLowerCase() === name.toLowerCase(),
    );
    return match?.id || null;
  };

  const deleteTransaction = async (id: string) => {
    try {
      await deleteTransactionFromStore(id);
      toast.success('Transaction deleted');
      setDeletingTx(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete transaction');
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await deleteAccountFromStore(id);
      toast.success('Account deleted');
      setDeletingAccount(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    }
  };

  const deleteEmi = async (id: string) => {
    try {
      await deleteEmiFromStore(id);
      toast.success('EMI deleted');
      setDeletingEmi(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete EMI');
    }
  };

  const toggleEmiPayment = async (paymentId: string, isPaid: boolean, accountId?: string) => {
    try {
      await toggleEmiPaymentFromStore(paymentId, isPaid, accountId);
      toast.success(isPaid ? 'EMI payment reverted' : 'EMI marked as paid');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update EMI payment');
    }
  };

  const deleteBudget = async (id: string) => {
    try {
      await deleteBudgetFromStore(id);
      toast.success('Budget deleted');
      setDeletingBudget(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete budget');
    }
  };

  const deleteSavingsGoal = async (id: string) => {
    try {
      await deleteSavingsGoalFromStore(id);
      toast.success('Savings goal deleted');
      setDeletingSavings(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete savings goal');
    }
  };

  const adjustSavingsGoal = async (id: string, amount: number, action: 'deposit' | 'withdraw') => {
    try {
      await adjustSavingsGoalFromStore(id, amount, action);
      toast.success(action === 'deposit' ? 'Savings updated' : 'Savings withdrawn');
    } catch (error: any) {
      toast.error(error.message || 'Failed to adjust savings');
    }
  };

  const saveDebtTracker = async () => {
    try {
      await saveDebtTrackerToStore({
        month: debtForm.month,
        opening_balance: debtOpeningBalance,
        auto_paid: autoDebtPaid,
        manual_paid: manualDebtPaid,
        auto_borrowed: autoDebtBorrowed,
        manual_borrowed: manualDebtBorrowed,
        opening_balance_mode: debtForm.opening_balance_mode,
      });
      toast.success('Debt tracker updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save debt tracker');
    }
  };

  const saveMonthlyPlan = async () => {
    try {
      const totalIncomeValue = Number(planForm.total_income) || 0;
      const allocatedSelf = Number(planForm.allocated_self) || 0;
      const allocatedFamily = Number(planForm.allocated_family) || 0;
      const allocatedDebt = Number(planForm.allocated_debt) || 0;
      await saveMonthlyPlanToStore({
        month: planForm.month,
        total_income: totalIncomeValue,
        allocated_self: allocatedSelf,
        allocated_family: allocatedFamily,
        allocated_debt: allocatedDebt,
      });
      toast.success('Monthly plan updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save monthly plan');
    }
  };

  const saveQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = Number(quickExpense.amount);
    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    if (!quickExpense.categoryId || !quickExpense.accountId) {
      toast.error('Category and account are required');
      return;
    }

    setSavingQuickExpense(true);
    try {
      const category = categoriesById.get(quickExpense.categoryId);
      const { error } = await insertTransactionWithFallback(
        supabase,
        {
          user_id: user.id,
          type: 'debit',
          amount,
          category_id: quickExpense.categoryId,
          category: category?.name || 'Other Expense',
          description: quickExpense.description || null,
          account_id: quickExpense.accountId,
          payment_mode: 'Quick Entry',
          transaction_date: quickExpense.transactionDate,
          spending_type: quickExpense.spendingType,
          source_module: 'manual',
        },
        supportsTransactionCategoryIds,
      );

      if (error) throw error;

      toast.success('Expense saved');
      setQuickExpense((current) => ({
        ...current,
        amount: '',
        description: '',
      }));
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save expense');
    } finally {
      setSavingQuickExpense(false);
    }
  };

  const deletingAccountName = accounts.find((account) => account.id === deletingAccount)?.name;
  const deletingEmiName = emis.find((emi) => emi.id === deletingEmi)?.name;
  const deletingBudgetName = budgets.find((budget) => budget.id === deletingBudget)?.category_name;
  const deletingSavingsName = savingsGoals.find((goal) => goal.id === deletingSavings)?.name;

  if (loading) {
    return (
      <AppLayout>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Financial Discipline System</h1>
            <p className="text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport} disabled={transactions.length === 0}>
              Export CSV
            </Button>
            <AddCategoryDialog onCategoryChanged={fetchData} />
            <AddAccountDialog onAccountAdded={fetchData} />
            <AddTransactionDialog
              accounts={accounts}
              categories={categories}
              supportsCategoryIds={supportsTransactionCategoryIds}
              onTransactionAdded={fetchData}
            />
          </div>
        </div>

        {disciplineAlerts.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <p className="font-semibold text-amber-700">Discipline Alerts</p>
              </div>
              {disciplineAlerts.map((alert) => (
                <div key={alert.id} className="rounded-lg border border-amber-200/60 bg-background/80 p-3">
                  <p className="font-medium text-foreground">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 border-none shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Daily Expense Tracker
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveQuickExpense} className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-1">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('w-full justify-start font-normal', !quickExpense.transactionDate && 'text-muted-foreground')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {quickExpense.transactionDate ? format(toDateValue(quickExpense.transactionDate)!, 'dd MMM yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DatePicker
                        mode="single"
                        selected={toDateValue(quickExpense.transactionDate)}
                        onSelect={(date) => {
                          if (date) setQuickExpense({ ...quickExpense, transactionDate: format(date, 'yyyy-MM-dd') });
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-1">
                  <Label>Account</Label>
                  <Select value={quickExpense.accountId} onValueChange={(value) => setQuickExpense({ ...quickExpense, accountId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1">
                  <Label>Category</Label>
                  <Select value={quickExpense.categoryId} onValueChange={(value) => setQuickExpense({ ...quickExpense, categoryId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quickExpense.amount}
                    onChange={(e) => setQuickExpense({ ...quickExpense, amount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="md:col-span-1">
                  <Label>Type</Label>
                  <Select
                    value={quickExpense.spendingType}
                    onValueChange={(value) => setQuickExpense({ ...quickExpense, spendingType: value as 'self' | 'family' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Self</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1 flex items-end">
                  <Button type="submit" className="w-full" disabled={savingQuickExpense}>
                    {savingQuickExpense ? 'Saving...' : 'Save'}
                  </Button>
                </div>
                <div className="md:col-span-6">
                  <Label>Description</Label>
                  <Textarea
                    value={quickExpense.description}
                    onChange={(e) => setQuickExpense({ ...quickExpense, description: e.target.value })}
                    placeholder="Optional note"
                    rows={2}
                  />
                </div>
              </form>
              <div className="mt-4 flex flex-wrap gap-3">
                <Badge variant="secondary">Today: {formatCurrency(todaySpending)}</Badge>
                <Badge variant="secondary">This Week: {formatCurrency(weekSpending)}</Badge>
                <Badge variant="secondary">Daily Guardrail: {formatCurrency(suggestedDailyLimit || 0)}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Monthly Discipline Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Live balance', value: formatCurrency(totalBalance), icon: Wallet, tone: 'text-blue-600' },
                { label: 'Income', value: formatCurrency(totalIncome), icon: TrendingUp, tone: 'text-green-600' },
                { label: 'Expenses', value: formatCurrency(totalExpenses), icon: TrendingDown, tone: 'text-red-600' },
                { label: 'Surplus', value: formatCurrency(totalIncome - totalExpenses), icon: Landmark, tone: totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600' },
                { label: 'Debt balance', value: formatCurrency(Number(latestDebt?.closing_balance || 0)), icon: CreditCard, tone: 'text-orange-600' },
                { label: 'EMI vs income', value: `${emiVsIncomePercent}%`, icon: ArrowRightLeft, tone: 'text-violet-600' },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${tone}`} />
                    </div>
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </div>
                  <span className={`font-semibold ${tone}`}>{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          {[
            { label: 'Today', value: formatCurrency(todaySpending), icon: CalendarDays, tone: 'text-orange-500' },
            { label: 'Week', value: formatCurrency(weekSpending), icon: CalendarRange, tone: 'text-purple-500' },
            { label: 'Month', value: formatCurrency(totalExpenses), icon: CalendarIcon, tone: 'text-red-500' },
            { label: 'Self', value: formatCurrency(selfSpending), icon: Wallet, tone: 'text-blue-500' },
            { label: 'Family', value: formatCurrency(familySpending), icon: PiggyBank, tone: 'text-emerald-500' },
            { label: 'Transfers', value: formatCurrency(transferVolume), icon: ArrowRightLeft, tone: 'text-slate-500' },
            { label: 'EMI Due', value: formatCurrency(totalEmiOutstanding), icon: CreditCard, tone: 'text-violet-500' },
            { label: 'Goals', value: String(savingsSummaries.filter(({ summary }) => summary.isCompleted).length), icon: Target, tone: 'text-pink-500' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${tone}`} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className={`text-lg font-bold ${tone}`}>{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="transactions" className="space-y-6">
          <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 flex-wrap sm:flex-nowrap overflow-x-auto no-scrollbar">
            {[
              ['transactions', 'Transactions'],
              ['accounts', 'Accounts'],
              ['budgets', 'Budgets'],
              ['savings', 'Savings Goals'],
              ['emis', 'EMIs'],
              ['debt', 'Debt Tracker'],
              ['planner', 'Cash Flow Planner'],
              ['analytics', 'Analytics'],
              ['reports', 'Reports'],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-semibold transition-all hover:text-primary"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="transactions" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Expense Tracker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="Search description, category, or account"
                      className="pl-10"
                    />
                  </div>
                  <Select value={txTypeFilter} onValueChange={(value) => setTxTypeFilter(value as TransactionTypeFilter)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="credit">Income</SelectItem>
                      <SelectItem value="debit">Expense</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={txCategoryFilter} onValueChange={setTxCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={txSpendingFilter} onValueChange={(value) => setTxSpendingFilter(value as SpendingFilter)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Spend type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All spend types</SelectItem>
                      <SelectItem value="self">Self</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={txFromDate} onChange={(e) => setTxFromDate(e.target.value)} />
                  <Input type="date" value={txToDate} onChange={(e) => setTxToDate(e.target.value)} />
                </div>

                <div className="flex flex-wrap justify-between gap-3 text-sm text-muted-foreground">
                  <p>Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions</p>
                  <div className="flex gap-4">
                    <span>Daily: {formatCurrency(todaySpending)}</span>
                    <span>Weekly: {formatCurrency(weekSpending)}</span>
                    <span>Monthly: {formatCurrency(totalExpenses)}</span>
                  </div>
                </div>

                <TransactionList
                  transactions={paginatedTransactions}
                  accountsById={accountsById}
                  onDelete={(id) => setDeletingTx(id)}
                  onEdit={setSelectedTransaction}
                />

                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => setTxPage((page) => Math.max(page - 1, 1))} disabled={txPage === 1}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {txPage} of {totalTxPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setTxPage((page) => Math.min(page + 1, totalTxPages))} disabled={txPage >= totalTxPages}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="m-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Your Accounts</CardTitle>
                <AddAccountDialog onAccountAdded={fetchData} />
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No accounts yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map((account) => (
                      <AccountCard key={account.id} account={account} onDelete={(id) => setDeletingAccount(id)} onUpdate={fetchData} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budgets" className="m-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Budget Discipline</CardTitle>
                <AddBudgetDialog
                  categories={categories}
                  existingBudgets={budgets.map((budget) => ({ categoryId: budget.category_id, type: budget.type }))}
                  supportsCategoryIds={supportsBudgetCategoryIds}
                  onBudgetAdded={fetchData}
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {budgets.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No budgets set.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {budgetSummaries.map(({ budget, usage }) => (
                      <div key={budget.id} className="space-y-2">
                        <BudgetCard
                          category={budget.category_name}
                          budgeted={usage.budgeted}
                          spent={usage.used}
                          color={budget.category_color || budget.color || '#8B5CF6'}
                          type={budget.type}
                          onDelete={() => setDeletingBudget(budget.id)}
                        />
                        <div className="px-1 text-xs text-muted-foreground flex items-center justify-between">
                          <span>{budget.carry_forward ? `Includes rollover ${formatCurrency(budget.rollover_amount)}` : 'No rollover'}</span>
                          <span className={
                            getBudgetSignal(usage.usagePercent) === 'critical'
                              ? 'text-red-600'
                              : getBudgetSignal(usage.usagePercent) === 'warning'
                                ? 'text-yellow-600'
                                : 'text-green-600'
                          }>
                            {usage.usagePercent.toFixed(0)}% used
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="savings" className="m-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Savings Goals
                </CardTitle>
                <AddSavingsGoalDialog accounts={accounts} onGoalAdded={fetchData} />
              </CardHeader>
              <CardContent>
                {savingsGoals.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No savings goals yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {savingsGoals.map((goal) => (
                      <SavingsGoalCard
                        key={goal.id}
                        goal={goal}
                        account={goal.account_id ? accountsById[goal.account_id] : undefined}
                        onDelete={(id) => setDeletingSavings(id)}
                        onAdjustGoal={adjustSavingsGoal}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emis" className="m-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>EMI Tracker</CardTitle>
                <AddEmiDialog accounts={accounts} onEmiAdded={fetchData} />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-muted/40">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Outstanding</p>
                      <p className="text-xl font-semibold">{formatCurrency(totalEmiOutstanding)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/40">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Monthly EMI Load</p>
                      <p className="text-xl font-semibold">{formatCurrency(totalEmiMonthly)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/40">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">EMI vs Income</p>
                      <p className="text-xl font-semibold">{emiVsIncomePercent}%</p>
                      <Progress value={Math.min(emiVsIncomePercent, 100)} className="mt-2" />
                    </CardContent>
                  </Card>
                </div>

                {emis.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No EMIs yet.</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {emis.map((emi) => (
                      <EmiCard
                        key={emi.id}
                        emi={emi}
                        payments={emiPayments.filter((payment) => payment.emi_id === emi.id)}
                        onPaymentToggle={toggleEmiPayment}
                        onDelete={setDeletingEmi}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debt" className="m-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle>Debt Tracker</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDebtQuickAction('payment')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Debt Payment
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDebtQuickAction('borrowed')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Borrowed
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Opening</p>
                        <p className="text-xs text-muted-foreground">{debtForm.opening_balance_mode === 'auto' ? 'From previous month' : 'Manual override'}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={debtForm.opening_balance_mode === 'auto' ? 'font-medium text-foreground' : 'text-muted-foreground'}>Auto</span>
                        <Switch
                          checked={debtForm.opening_balance_mode === 'manual'}
                          onCheckedChange={(checked) =>
                            setDebtForm({
                              ...debtForm,
                              opening_balance_mode: checked ? 'manual' : 'auto',
                              opening_balance: checked ? debtForm.opening_balance : String(autoOpeningBalance),
                            })
                          }
                        />
                        <span className={debtForm.opening_balance_mode === 'manual' ? 'font-medium text-foreground' : 'text-muted-foreground'}>Manual</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Month</Label>
                      <Input value={debtForm.month} onChange={(e) => setDebtForm({ ...debtForm, month: e.target.value })} placeholder="YYYY-MM" />
                    </div>
                    <div className="space-y-2">
                      <Label>Opening Balance</Label>
                      <Input
                        value={debtForm.opening_balance_mode === 'auto' ? String(autoOpeningBalance) : debtForm.opening_balance}
                        onChange={(e) => setDebtForm({ ...debtForm, opening_balance: e.target.value, opening_balance_mode: 'manual' })}
                        type="number"
                        readOnly={debtForm.opening_balance_mode === 'auto'}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <p className="text-sm font-medium">Paid</p>
                    <div className="space-y-2">
                      <Label>Auto Paid</Label>
                      <Input value={autoDebtPaid} readOnly type="number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Manual Paid</Label>
                      <Input value={debtForm.manual_paid} onChange={(e) => setDebtForm({ ...debtForm, manual_paid: e.target.value })} type="number" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <p className="text-sm font-medium">Borrowed</p>
                    <div className="space-y-2">
                      <Label>Auto Borrowed</Label>
                      <Input value={autoDebtBorrowed} readOnly type="number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Manual Borrowed</Label>
                      <Input value={debtForm.manual_borrowed} onChange={(e) => setDebtForm({ ...debtForm, manual_borrowed: e.target.value })} type="number" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Result</p>
                      <p className="text-xs text-muted-foreground">Auto calculated</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Closing Balance</p>
                      <p className="text-2xl font-semibold">{formatCurrency(debtClosingBalance)}</p>
                    </div>
                    <Button onClick={saveDebtTracker}>Save Debt Month</Button>
                  </div>
                </div>

                {(showBorrowAlert || showDebtMismatchAlert) && (
                  <div className="space-y-2">
                    {showBorrowAlert && (
                      <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-200">
                        <AlertTriangle className="h-4 w-4" />
                        You are increasing your debt
                      </div>
                    )}
                    {showDebtMismatchAlert && (
                      <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200">
                        <AlertTriangle className="h-4 w-4" />
                        Check missing transactions
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {debtTracker.map((entry) => (
                    <div key={entry.id || entry.month} className="rounded-xl border border-border p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Month</p>
                        <p className="font-medium">{entry.month}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Opening</p>
                        <p>{formatCurrency(Number(entry.opening_balance))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Auto Paid</p>
                        <p>{formatCurrency(Number(entry.auto_paid ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Manual Paid</p>
                        <p>{formatCurrency(Number(entry.manual_paid ?? entry.paid_amount ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Borrowed</p>
                        <p>{formatCurrency(Number((entry.auto_borrowed ?? 0) + (entry.manual_borrowed ?? entry.borrowed_amount ?? 0)))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Closing</p>
                        <p className="font-semibold">{formatCurrency(Number(entry.closing_balance))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="planner" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Planner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Input value={planForm.month} onChange={(e) => setPlanForm({ ...planForm, month: e.target.value })} placeholder="YYYY-MM" />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Income</Label>
                    <Input value={planForm.total_income} onChange={(e) => setPlanForm({ ...planForm, total_income: e.target.value })} type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Allocate Self</Label>
                    <Input value={planForm.allocated_self} onChange={(e) => setPlanForm({ ...planForm, allocated_self: e.target.value })} type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Allocate Family</Label>
                    <Input value={planForm.allocated_family} onChange={(e) => setPlanForm({ ...planForm, allocated_family: e.target.value })} type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Allocate Debt</Label>
                    <Input value={planForm.allocated_debt} onChange={(e) => setPlanForm({ ...planForm, allocated_debt: e.target.value })} type="number" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Planned income', value: Number(planForm.total_income) || 0 },
                    { label: 'Self budget', value: Number(planForm.allocated_self) || 0 },
                    { label: 'Family budget', value: Number(planForm.allocated_family) || 0 },
                    { label: 'Remaining balance', value: (Number(planForm.total_income) || 0) - (Number(planForm.allocated_self) || 0) - (Number(planForm.allocated_family) || 0) - (Number(planForm.allocated_debt) || 0) },
                  ].map((item) => (
                    <Card key={item.label} className="bg-muted/40">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className="text-xl font-semibold">{formatCurrency(item.value)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveMonthlyPlan}>Save Monthly Plan</Button>
                </div>

                <div className="space-y-3">
                  {monthlyPlans.map((plan) => (
                    <div key={plan.id || plan.month} className="rounded-xl border border-border p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Month</p>
                        <p className="font-medium">{plan.month}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Income</p>
                        <p>{formatCurrency(Number(plan.total_income))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Self</p>
                        <p>{formatCurrency(Number(plan.allocated_self))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Family</p>
                        <p>{formatCurrency(Number(plan.allocated_family))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Remaining</p>
                        <p className="font-semibold">{formatCurrency(Number(plan.remaining_balance))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="m-0">
            <div className="space-y-6">
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    <h3 className="text-lg font-semibold">Net Savings This Month</h3>
                  </div>
                  <p className={`text-3xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    {formatCurrency(totalIncome - totalExpenses)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatCurrency(totalIncome)} income - {formatCurrency(totalExpenses)} expenses
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-primary" />
                    Income vs Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    Self vs Family Split
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="Self" stroke="#2563EB" strokeWidth={3} />
                      <Line type="monotone" dataKey="Family" stroke="#10B981" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {pieData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieIcon className="w-5 h-5 text-primary" />
                      Category Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false}>
                            {pieData.map((entry, index) => (
                              <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 min-w-48">
                        {pieData.map((entry, index) => (
                          <div key={entry.name} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            <span className="text-foreground">{entry.name}</span>
                            <span className="text-muted-foreground ml-auto">{formatCurrency(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reports" className="m-0">
            <Suspense fallback={<SkeletonCard count={1} />}>
              <AccountReport accounts={accounts} transactions={transactions} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      <AddTransactionDialog
        open={!!selectedTransaction || !!debtQuickAction}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTransaction(null);
            setDebtQuickAction(null);
          }
        }}
        transaction={selectedTransaction}
        accounts={accounts}
        categories={categories}
        supportsCategoryIds={supportsTransactionCategoryIds}
        initialType={debtQuickAction === 'borrowed' ? 'credit' : 'debit'}
        initialCategoryName={debtQuickAction === 'borrowed' ? 'Borrowed' : 'Debt Payment'}
        initialSpendingType="self"
        onTransactionAdded={async () => {
          setSelectedTransaction(null);
          setDebtQuickAction(null);
          await fetchData();
        }}
      />

      <AlertDialog open={!!deletingTx} onOpenChange={(open) => { if (!open) setDeletingTx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingTx && void deleteTransaction(deletingTx)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingAccount} onOpenChange={(open) => { if (!open) setDeletingAccount(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>Delete "{deletingAccountName}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingAccount && void deleteAccount(deletingAccount)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingEmi} onOpenChange={(open) => { if (!open) setDeletingEmi(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete EMI</AlertDialogTitle>
            <AlertDialogDescription>Delete "{deletingEmiName}" and all linked payments? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingEmi && void deleteEmi(deletingEmi)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingBudget} onOpenChange={(open) => { if (!open) setDeletingBudget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>Delete "{deletingBudgetName}" budget? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingBudget && void deleteBudget(deletingBudget)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingSavings} onOpenChange={(open) => { if (!open) setDeletingSavings(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Savings Goal</AlertDialogTitle>
            <AlertDialogDescription>Delete "{deletingSavingsName}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingSavings && void deleteSavingsGoal(deletingSavings)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
