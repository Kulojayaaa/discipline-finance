import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
import { useTodayNotifications } from '@/components/dashboard/TodayNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/CurrencyContext';
import { useFinanceStore } from '@/store/financeStore';
import { getTodayDate, getMonthStartDate } from '@/lib/date';
import {
  Wallet,
  FileText,
  TrendingUp,
  Flame,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Landmark,
  CreditCard,
  ArrowRightLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { computeBudgetUsage, getMonthKey } from '@/lib/finance';

interface DashboardStats {
  activeHabits: number;
  todayCompletions: number;
  todaySpending: number;
  monthExpenses: number;
  monthIncome: number;
  upcomingReminders: number;
  savingsProgress: number;
  pendingBills: number;
  totalAccountBalance: number;
  totalEmiLiability: number;
  savingsCurrentTotal: number;
  savingsTargetTotal: number;
  selfSpending: number;
  familySpending: number;
  surplus: number;
  debtBalance: number;
  overBudgetCategories: string[];
  dailyLimitExceeded: boolean;
  debtIncreased: boolean;
  dailyLimit: number;
}

const EMPTY_STATS: DashboardStats = {
  activeHabits: 0,
  todayCompletions: 0,
  todaySpending: 0,
  monthExpenses: 0,
  monthIncome: 0,
  upcomingReminders: 0,
  savingsProgress: 0,
  pendingBills: 0,
  totalAccountBalance: 0,
  totalEmiLiability: 0,
  savingsCurrentTotal: 0,
  savingsTargetTotal: 0,
  selfSpending: 0,
  familySpending: 0,
  surplus: 0,
  debtBalance: 0,
  overBudgetCategories: [],
  dailyLimitExceeded: false,
  debtIncreased: false,
  dailyLimit: 0,
};

async function fetchDashboardExtras(userId: string) {
  const today = getTodayDate();
  const [habitsRes, completionsRes, remindersRes, billsRes] = await Promise.all([
    supabase.from('habits').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
    supabase.from('habit_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('completed_at', today),
    supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', false).gte('reminder_date', today),
    supabase.from('bills').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_paid', false),
  ]);

  if (habitsRes.error) throw habitsRes.error;
  if (completionsRes.error) throw completionsRes.error;
  if (remindersRes.error) throw remindersRes.error;
  if (billsRes.error) throw billsRes.error;

  return {
    activeHabits: habitsRes.count ?? 0,
    todayCompletions: completionsRes.count ?? 0,
    upcomingReminders: remindersRes.count ?? 0,
    pendingBills: billsRes.count ?? 0,
  };
}

const Index = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  useTodayNotifications();

  const {
    accounts,
    budgets,
    debtTracker,
    emiPayments,
    loading,
    monthlyPlans,
    refresh,
    savingsGoals,
    transactions,
  } = useFinanceStore();

  useEffect(() => {
    if (user?.id) {
      void refresh(user.id);
    }
  }, [refresh, user?.id]);

  const { data: dashboardExtras } = useQuery({
    queryKey: ['dashboard-extras', user?.id],
    queryFn: () => fetchDashboardExtras(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const currentMonth = format(new Date(), 'MMMM yyyy');
  const monthStart = getMonthStartDate();
  const today = getTodayDate();
  const monthTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.transaction_date >= monthStart),
    [monthStart, transactions],
  );

  const stats = useMemo<DashboardStats>(() => {
    const todaySpending = monthTransactions
      .filter((transaction) => transaction.type === 'debit' && transaction.transaction_date === today)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const monthExpenses = monthTransactions
      .filter((transaction) => transaction.type === 'debit')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const monthIncome = monthTransactions
      .filter((transaction) => transaction.type === 'credit')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const savingsTargetTotal = savingsGoals.reduce((sum, goal) => sum + goal.target_amount, 0);
    const savingsCurrentTotal = savingsGoals.reduce((sum, goal) => sum + goal.current_amount, 0);
    const budgetUsage = budgets.map((budget) => ({ budget, usage: computeBudgetUsage(budget, monthTransactions) }));
    const overBudgetCategories = budgetUsage
      .filter(({ usage, budget }) => usage.usagePercent >= (budget.alertThreshold || 80))
      .map(({ budget }) => `${budget.category_name} (${budget.type})`);
    const daysRemaining = Math.max(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1, 1);
    const plan = monthlyPlans.find((entry) => entry.month === getMonthKey());
    const dailyLimit = Number(plan?.remaining_balance || 0) > 0
      ? Number(plan?.remaining_balance || 0) / daysRemaining
      : budgetUsage.reduce((sum, entry) => sum + Math.max(entry.usage.remaining, 0), 0) / daysRemaining;
    const latestDebt = debtTracker[0];

    return {
      ...EMPTY_STATS,
      activeHabits: dashboardExtras?.activeHabits ?? 0,
      todayCompletions: dashboardExtras?.todayCompletions ?? 0,
      upcomingReminders: dashboardExtras?.upcomingReminders ?? 0,
      pendingBills: dashboardExtras?.pendingBills ?? 0,
      todaySpending,
      monthExpenses,
      monthIncome,
      totalAccountBalance: accounts.reduce((sum, account) => sum + account.computed_balance, 0),
      totalEmiLiability: emiPayments
        .filter((payment) => !payment.is_paid)
        .reduce((sum, payment) => sum + payment.principal_component + payment.interest_component, 0),
      savingsCurrentTotal,
      savingsTargetTotal,
      savingsProgress: savingsTargetTotal > 0 ? Math.round((savingsCurrentTotal / savingsTargetTotal) * 100) : 0,
      surplus: monthIncome - monthExpenses,
      debtBalance: Number(latestDebt?.closing_balance || 0),
      debtIncreased: Number(latestDebt?.closing_balance || 0) > Number(latestDebt?.opening_balance || 0),
      overBudgetCategories,
      dailyLimit,
      dailyLimitExceeded: dailyLimit > 0 && todaySpending > dailyLimit,
      selfSpending: monthTransactions
        .filter((transaction) => transaction.type === 'debit' && transaction.spending_type === 'self')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      familySpending: monthTransactions
        .filter((transaction) => transaction.type === 'debit' && transaction.spending_type === 'family')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    };
  }, [accounts, budgets, dashboardExtras, debtTracker, emiPayments, monthTransactions, monthlyPlans, savingsGoals, today]);

  const isLoading = loading;
  const habitScore = stats.activeHabits > 0 ? Math.round((stats.todayCompletions / stats.activeHabits) * 100) : 0;

  const alerts = useMemo(() => {
    const items: Array<{ id: string; title: string; body: string }> = [];
    if (stats.overBudgetCategories.length > 0) {
      items.push({
        id: 'budget',
        title: 'Budget alert',
        body: `Over budget in ${stats.overBudgetCategories.join(', ')}.`,
      });
    }
    if (stats.dailyLimitExceeded) {
      items.push({
        id: 'daily',
        title: 'Daily limit exceeded',
        body: `Today's spending crossed ${formatCurrency(stats.dailyLimit)}.`,
      });
    }
    if (stats.debtIncreased) {
      items.push({
        id: 'debt',
        title: 'Debt increased',
        body: `Current debt balance is ${formatCurrency(stats.debtBalance)}.`,
      });
    }
    return items;
  }, [formatCurrency, stats.dailyLimit, stats.dailyLimitExceeded, stats.debtBalance, stats.debtIncreased, stats.overBudgetCategories]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Financial discipline dashboard
          </h1>
          <p className="text-muted-foreground">Here&apos;s your overview for {currentMonth}</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard count={1} />
            <SkeletonCard count={1} />
          </div>
        ) : (
          <>
            {alerts.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <p className="font-semibold text-destructive">Attention needed</p>
                  </div>
                  {alerts.map((alert) => (
                    <div key={alert.id}>
                      <p className="font-medium text-foreground">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.body}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Today&apos;s Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Habits</p>
                    <p className="text-lg font-bold">{stats.todayCompletions} / {stats.activeHabits}</p>
                    <Progress value={habitScore} className="h-1.5 mt-1" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Spending</p>
                    <p className="text-lg font-bold text-red-500">{formatCurrency(stats.todaySpending)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Self vs Family</p>
                    <p className="text-lg font-bold">{formatCurrency(stats.selfSpending)} / {formatCurrency(stats.familySpending)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bills Due</p>
                    <p className="text-lg font-bold text-orange-500">{stats.pendingBills}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Daily Guardrail</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(stats.dailyLimit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard title="Live Balance" value={formatCurrency(stats.totalAccountBalance)} icon={Landmark} gradient="success" subtitle="Computed from transactions" />
              <StatCard title="Income" value={formatCurrency(stats.monthIncome)} icon={TrendingUp} gradient="success" subtitle="This month" />
              <StatCard title="Expenses" value={formatCurrency(stats.monthExpenses)} icon={Wallet} gradient="warm" subtitle="This month" />
              <StatCard title="Surplus" value={formatCurrency(stats.surplus)} icon={ArrowRightLeft} gradient="cool" subtitle="Income - expenses" />
            </div>

            <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                  Finance Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Debt Balance</p>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(stats.debtBalance)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">EMI Outstanding</p>
                    <p className="text-2xl font-bold text-orange-500">{formatCurrency(stats.totalEmiLiability)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Savings</p>
                    <p className="text-2xl font-bold text-blue-500">{formatCurrency(stats.savingsCurrentTotal)}</p>
                    <p className="text-xs text-muted-foreground">of {formatCurrency(stats.savingsTargetTotal)} target</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Savings Progress</p>
                    <p className="text-2xl font-bold text-primary">{stats.savingsProgress}%</p>
                    <Progress value={stats.savingsProgress} className="h-1.5 mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard title="Upcoming Reminders" value={stats.upcomingReminders} icon={Bell} gradient="cool" />
              <StatCard title="Notes" value="View Notes" icon={FileText} gradient="primary" isLink linkTo="/notes" />
            </div>

            {stats.overBudgetCategories.length > 0 && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-destructive">Budget pressure</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.overBudgetCategories.map((category) => (
                        <Badge key={category} variant="destructive" className="ml-1 text-xs">{category}</Badge>
                      ))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <UpcomingEvents />
        <QuickActions />

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 p-6 border border-border/50">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <Flame className="h-6 w-6 text-orange-500 animate-pulse" />
              <h3 className="text-lg font-semibold">Keep the momentum</h3>
            </div>
            <p className="text-muted-foreground">
              Daily entries, budget corrections, and debt reduction all compound. The <Link to="/expenses" className="text-primary hover:underline">expenses workspace</Link> is where you can act on today&apos;s alerts.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
