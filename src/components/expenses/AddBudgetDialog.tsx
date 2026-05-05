import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/CurrencyContext';
import {
  FinanceCategory,
  SpendingType,
  getMonthKey,
  isInvalidIntegerInputError,
  isMissingAnyColumnError,
  parseMonthKey,
} from '@/lib/finance';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const colors = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6', '#F97316'];
const addBudgetSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  type: z.enum(['self', 'family']),
  amount: z.coerce.number().positive('Budget amount must be greater than 0'),
  carryForward: z.boolean().default(false),
  rolloverAmount: z.coerce.number().min(0, 'Rollover amount cannot be negative').default(0),
  color: z.string().min(1),
});

type AddBudgetValues = z.infer<typeof addBudgetSchema>;

async function insertBudgetWithFallback(payload: Record<string, unknown>, _supportsCategoryIds: boolean) {
  const monthKey = String(payload.month || getMonthKey());
  const { month, year } = parseMonthKey(monthKey);
  const plannedAmount = payload.planned_amount ?? payload.amount;
  const common = {
    user_id: payload.user_id,
    category_id: payload.category_id,
    category: payload.category,
    type: payload.type,
    planned_amount: plannedAmount,
    amount: plannedAmount,
    monthly_limit: plannedAmount,
    limit_amount: plannedAmount,
    carry_forward: payload.carry_forward,
    rollover_amount: payload.rollover_amount,
    color: payload.color,
  };

  if (!common.category_id) {
    return { error: { message: 'Please select a category before saving the budget.' } };
  }

  const variants = [
    { ...common, month, year, month_key: monthKey },
    { ...common, month, year },
    {
      user_id: payload.user_id,
      category_id: payload.category_id,
      month,
      year,
      planned_amount: plannedAmount,
    },
    {
      user_id: payload.user_id,
      category: payload.category,
      amount: plannedAmount,
      month,
      year,
      color: payload.color,
    },
    { ...common, month: monthKey, month_key: monthKey },
    {
      user_id: payload.user_id,
      category_id: payload.category_id,
      month: monthKey,
      planned_amount: plannedAmount,
    },
  ];

  for (const variant of variants) {
    const { error } = await supabase.from('budgets').insert(variant as never);
    if (!error) return { error: null };
    if (!isMissingAnyColumnError(error) && !isInvalidIntegerInputError(error)) return { error };
  }

  return { error: { message: 'Failed to create budget with the available database schema.' } };
}

interface AddBudgetDialogProps {
  categories: FinanceCategory[];
  existingBudgets: Array<{ categoryId: string; type: SpendingType }>;
  onBudgetAdded: () => void;
  supportsCategoryIds?: boolean;
}

export function AddBudgetDialog({ categories, existingBudgets, onBudgetAdded, supportsCategoryIds = true }: AddBudgetDialogProps) {
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const [open, setOpen] = useState(false);

  const form = useForm<AddBudgetValues>({
    resolver: zodResolver(addBudgetSchema),
    defaultValues: {
      categoryId: '',
      type: 'self',
      amount: 0,
      carryForward: false,
      rolloverAmount: 0,
      color: colors[0],
    },
  });

  const selectedType = form.watch('type');
  const usedCategoryIdsForType = new Set(
    existingBudgets.filter((budget) => budget.type === selectedType).map((budget) => budget.categoryId),
  );
  const availableCategories = categories
    .filter((category) => category.type === 'expense' && !usedCategoryIdsForType.has(category.id))
    .sort((left, right) => left.name.localeCompare(right.name));

  const handleSubmit = form.handleSubmit(async (values) => {
    const selectedCategory = categories.find((category) => category.id === values.categoryId);

    try {
      if (!user?.id) throw new Error('Please sign in before creating a budget.');

      const payload = {
        user_id: user.id,
        category_id: values.categoryId,
        category: selectedCategory?.name || 'Other Expense',
        type: values.type,
        amount: values.amount,
        month: getMonthKey(),
        carry_forward: values.carryForward,
        rollover_amount: values.carryForward ? values.rolloverAmount : 0,
        color: values.color,
      };

      const { error } = await insertBudgetWithFallback(payload, supportsCategoryIds);
      if (error) throw error;

      toast.success('Budget created!');
      form.reset({
        categoryId: '',
        type: 'self',
        amount: 0,
        carryForward: false,
        rolloverAmount: 0,
        color: colors[0],
      });
      setOpen(false);
      onBudgetAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create budget');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="w-4 h-4 mr-2" /> Add Budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Monthly Budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <span className="flex items-center gap-2">
                          <span>{category.icon || '•'}</span>
                          <span>{category.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.categoryId && <p className="text-sm text-destructive">{form.formState.errors.categoryId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Budget Type</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value: SpendingType) => {
                    field.onChange(value);
                    const selectedCategoryId = form.getValues('categoryId');
                    if (
                      existingBudgets.some(
                        (budget) => budget.categoryId === selectedCategoryId && budget.type === value,
                      )
                    ) {
                      form.setValue('categoryId', '');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Self</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-amount">Budget Amount ({currencySymbol})</Label>
            <Input id="budget-amount" type="number" step="0.01" {...form.register('amount')} />
            {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="carry-forward">Carry Forward</Label>
                <p className="text-xs text-muted-foreground">Roll unused budget into this month.</p>
              </div>
              <Controller
                control={form.control}
                name="carryForward"
                render={({ field }) => (
                  <Switch id="carry-forward" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            {form.watch('carryForward') && (
              <div className="space-y-2">
                <Label htmlFor="rollover-amount">Rollover Amount ({currencySymbol})</Label>
                <Input id="rollover-amount" type="number" step="0.01" {...form.register('rolloverAmount')} />
                {form.formState.errors.rolloverAmount && <p className="text-sm text-destructive">{form.formState.errors.rolloverAmount.message}</p>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue('color', color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    form.watch('color') === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting} className="gradient-primary text-white">
              {form.formState.isSubmitting ? 'Creating...' : 'Create Budget'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
