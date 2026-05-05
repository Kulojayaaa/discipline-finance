import { Button } from '@/components/ui/button';
import { Trash2, Calendar, Plus, Minus, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/CurrencyContext';
import { computeSavingsGoal, FinanceAccount, FinanceSavingsGoal } from '@/lib/finance';

interface SavingsGoalCardProps {
  goal: FinanceSavingsGoal;
  account?: FinanceAccount;
  onDelete: (id: string) => void;
  onAdjustGoal: (id: string, amount: number, action: 'deposit' | 'withdraw') => void;
}

export function SavingsGoalCard({ goal, account, onDelete, onAdjustGoal }: SavingsGoalCardProps) {
  const [open, setOpen] = useState(false);
  const [adjustment, setAdjustment] = useState('');
  const { formatCurrency, currencySymbol } = useCurrency();
  const summary = useMemo(() => computeSavingsGoal(goal), [goal]);

  const getProgressColor = () => {
    if (summary.isCompleted) return goal.color || '#22C55E';
    if (summary.progressPercent >= 75) return '#22C55E';
    if (summary.progressPercent >= 50) return '#F97316';
    return goal.color || '#3B82F6';
  };

  const handleAdjustment = (action: 'deposit' | 'withdraw') => {
    const amount = Number(adjustment);
    if (!amount || amount <= 0) return;

    onAdjustGoal(goal.id, amount, action);
    setAdjustment('');
    setOpen(false);
  };

  return (
    <div
      className={cn(
        'p-4 rounded-xl border-2 bg-card group transition-all',
        summary.isCompleted ? 'border-green-500/50 bg-green-500/5' : 'border-border hover:shadow-md',
      )}
      style={{ borderLeftColor: goal.color || undefined, borderLeftWidth: '4px' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${goal.color || '#3B82F6'}20` }}>
            {goal.icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{goal.name}</h3>
            {goal.deadline && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Calendar className="w-3 h-3" />
                <span>Target: {format(new Date(goal.deadline), 'MMM dd, yyyy')}</span>
              </div>
            )}
            {account && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Wallet className="w-3 h-3" />
                <span>{account.name}</span>
              </div>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onDelete(goal.id)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      <div className="mb-3 text-center py-2 bg-muted/30 rounded-lg">
        <div className="text-2xl font-bold text-foreground">{formatCurrency(goal.current_amount)}</div>
        <div className="text-sm text-muted-foreground">of {formatCurrency(goal.target_amount)} goal</div>
      </div>

      <div className="relative h-3 mb-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{
            width: `${summary.progressPercent}%`,
            backgroundColor: getProgressColor(),
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground mb-4">
        <span>{summary.progressPercent.toFixed(0)}% complete</span>
        <span className="text-right">{summary.isCompleted ? 'Completed' : `${formatCurrency(summary.remainingAmount)} to go`}</span>
        <span>{summary.daysRemaining === null ? 'No deadline' : `${summary.daysRemaining} days left`}</span>
        <span className="text-right">
          {summary.requiredMonthlySaving > 0 ? `${formatCurrency(summary.requiredMonthlySaving)}/month` : 'On track'}
        </span>
      </div>

      {!summary.isCompleted ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full" style={{ backgroundColor: goal.color || undefined }}>
              <Plus className="w-4 h-4 mr-2" />
              Save or Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adjust Savings - {goal.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Amount ({currencySymbol})</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  min="0"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleAdjustment('deposit')} disabled={!adjustment}>
                  <Plus className="w-4 h-4 mr-2" />
                  Deposit
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => handleAdjustment('withdraw')} disabled={!adjustment}>
                  <Minus className="w-4 h-4 mr-2" />
                  Withdraw
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="text-center py-2 text-green-600 font-medium bg-green-500/10 rounded-lg">Goal achieved</div>
      )}
    </div>
  );
}
