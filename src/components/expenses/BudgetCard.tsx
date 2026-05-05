import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/CurrencyContext';
import { SpendingType } from '@/lib/finance';

interface BudgetCardProps {
  category: string;
  budgeted: number;
  spent: number;
  color: string;
  type?: SpendingType;
  onDelete?: () => void;
}

export function BudgetCard({ category, budgeted, spent, color, type, onDelete }: BudgetCardProps) {
  const { formatCurrency } = useCurrency();
  const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const displayPercentage = Math.min(percentage, 100);
  const remaining = budgeted - spent;
  const isOverBudget = spent > budgeted;

  const getProgressColor = () => {
    if (percentage > 100) return '#EF4444';
    if (percentage >= 70) return '#FACC15';
    return '#22C55E';
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-medium text-foreground">{category}</span>
          {type && (
            <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">
              {type}
            </Badge>
          )}
          {isOverBudget && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="w-3 h-3" /> Over budget!
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', isOverBudget ? 'text-destructive' : 'text-muted-foreground')}>
            {isOverBudget
              ? `Over by ${formatCurrency(Math.abs(remaining))}`
              : `${formatCurrency(remaining)} left`}
          </span>
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={onDelete}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative h-2 mb-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{ width: `${displayPercentage}%`, backgroundColor: getProgressColor() }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(spent)} spent ({percentage.toFixed(0)}%)</span>
        <span>{formatCurrency(budgeted)} budget</span>
      </div>
    </div>
  );
}
