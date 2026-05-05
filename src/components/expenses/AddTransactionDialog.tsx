import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/CurrencyContext';
import {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceTransactionType,
} from '@/lib/finance';
import { addTransaction, updateTransaction } from '@/services/financeService';
import { cn } from '@/lib/utils';

const PAYMENT_MODES = ['UPI', 'Card', 'Cash', 'Net Banking', 'Cheque'];

const toDateValue = (value: string) => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

interface AddTransactionDialogProps {
  accounts: FinanceAccount[];
  categories?: FinanceCategory[];
  onTransactionAdded: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  transaction?: FinanceTransaction | null;
  supportsCategoryIds?: boolean;
  initialType?: FinanceTransactionType;
  initialCategoryName?: string;
  initialSpendingType?: 'self' | 'family';
}

interface FormState {
  amount: string;
  categoryId: string;
  description: string;
  accountId: string;
  toAccountId: string;
  paymentMode: string;
  transactionDate: string;
  spendingType: 'self' | 'family';
}

const buildInitialForm = (
  transaction?: FinanceTransaction | null,
  draft?: Partial<Pick<FormState, 'categoryId' | 'spendingType'>>,
): FormState => ({
  amount: transaction ? String(transaction.amount) : '',
  categoryId: transaction?.category_id || draft?.categoryId || '',
  description: transaction?.description || '',
  accountId: transaction?.account_id || '',
  toAccountId: transaction?.to_account_id || '',
  paymentMode: transaction?.payment_mode || '',
  transactionDate: transaction?.transaction_date || format(new Date(), 'yyyy-MM-dd'),
  spendingType: transaction?.spending_type || draft?.spendingType || 'self',
});

export function AddTransactionDialog({
  accounts,
  categories: providedCategories,
  onTransactionAdded,
  open: externalOpen,
  onOpenChange: setExternalOpen,
  transaction,
  supportsCategoryIds = true,
  initialType,
  initialCategoryName,
  initialSpendingType = 'self',
}: AddTransactionDialogProps) {
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<FinanceTransactionType>(transaction?.type || initialType || 'debit');
  const [categories, setCategories] = useState<FinanceCategory[]>(providedCategories || []);
  const [formData, setFormData] = useState<FormState>(buildInitialForm(transaction));

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (setExternalOpen) setExternalOpen(value);
    setInternalOpen(value);
  };

  useEffect(() => {
    if (providedCategories) {
      setCategories(providedCategories);
    }
  }, [providedCategories]);

  useEffect(() => {
    if (!open || providedCategories) return;

    const fetchCategories = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('categories')
        .select('id, name, type, icon, color')
        .eq('user_id', user.id)
        .order('name');
      if (data) {
        setCategories(data as FinanceCategory[]);
      }
    };

    void fetchCategories();
  }, [open, providedCategories, user?.id]);

  useEffect(() => {
    const draftType = transaction?.type || initialType || 'debit';
    const draftCategory = initialCategoryName
      ? categories.find(
          (category) =>
            category.name.toLowerCase() === initialCategoryName.toLowerCase() &&
            category.type === (draftType === 'credit' ? 'income' : 'expense'),
        )
      : null;
    setType(draftType);
    setFormData(buildInitialForm(transaction, { categoryId: draftCategory?.id || '', spendingType: initialSpendingType }));
  }, [categories, initialCategoryName, initialSpendingType, initialType, transaction, open]);

  useEffect(() => {
    if (open && !formData.accountId && accounts.length > 0) {
      setFormData((current) => ({ ...current, accountId: accounts[0].id }));
    }
  }, [accounts, formData.accountId, open]);

  const availableCategories = useMemo(() => {
    const targetType = type === 'credit' ? 'income' : 'expense';
    return categories
      .filter((category) => category.type === targetType)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [categories, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = Number(formData.amount);
    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    if (!formData.accountId) {
      toast.error('Please choose an account');
      return;
    }
    if (type !== 'transfer' && !formData.categoryId) {
      toast.error('Category is required');
      return;
    }
    if (type === 'transfer' && !formData.toAccountId) {
      toast.error('Choose the destination account');
      return;
    }
    const transferCategory = categories.find(
      (category) => category.type === 'expense' && category.name.toLowerCase() === 'transfer',
    );
    if (type === 'transfer' && supportsCategoryIds && !transferCategory) {
      toast.error('Transfer category is missing. Refresh the finance workspace and try again.');
      return;
    }

    setLoading(true);
    try {
      const selectedCategory = categories.find((category) => category.id === formData.categoryId);
      const payload = {
        userId: user.id,
        type,
        amount,
        categoryId: type === 'transfer' ? transferCategory?.id || null : formData.categoryId,
        categoryName: type === 'transfer' ? 'Transfer' : selectedCategory?.name || 'Other Expense',
        notes: formData.description || null,
        accountId: formData.accountId,
        transferAccountId: type === 'transfer' ? formData.toAccountId : null,
        paymentMode: formData.paymentMode || null,
        date: formData.transactionDate,
        spendingType: type === 'debit' ? formData.spendingType : null,
        sourceModule: transaction?.source_module || 'manual',
        referenceId: transaction?.reference_id || null,
        supportsCategoryIds,
      };

      if (transaction?.id) {
        await updateTransaction(transaction.id, payload);
        toast.success('Transaction updated');
      } else {
        await addTransaction(payload);
        toast.success('Transaction added successfully!');
      }

      setFormData(buildInitialForm(null));
      setType('debit');
      setOpen(false);
      onTransactionAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
        </DialogHeader>
        <Tabs value={type} onValueChange={(value) => setType(value as FinanceTransactionType)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="debit" className="gap-2">
              <ArrowUpRight className="w-4 h-4 text-destructive" />
              Expense
            </TabsTrigger>
            <TabsTrigger value="credit" className="gap-2">
              <ArrowDownLeft className="w-4 h-4 text-green-500" />
              Income
            </TabsTrigger>
            <TabsTrigger value="transfer" className="gap-2">
              <ArrowLeftRight className="w-4 h-4 text-blue-500" />
              Transfer
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Amount ({currencySymbol})</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{type === 'transfer' ? 'From Account' : 'Account'}</Label>
            <Select value={formData.accountId} onValueChange={(value) => setFormData({ ...formData, accountId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === 'transfer' && (
            <div className="space-y-2">
              <Label>To Account</Label>
              <Select value={formData.toAccountId} onValueChange={(value) => setFormData({ ...formData, toAccountId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter((account) => account.id !== formData.accountId).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.icon} {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {type !== 'transfer' && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.icon || '•'} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === 'debit' && (
            <div className="space-y-2">
              <Label>Spend Type</Label>
              <Select value={formData.spendingType} onValueChange={(value) => setFormData({ ...formData, spendingType: value as 'self' | 'family' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select value={formData.paymentMode} onValueChange={(value) => setFormData({ ...formData, paymentMode: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('w-full justify-start font-normal', !formData.transactionDate && 'text-muted-foreground')}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {formData.transactionDate ? format(toDateValue(formData.transactionDate)!, 'dd MMM yyyy') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DatePicker
                  mode="single"
                  selected={toDateValue(formData.transactionDate)}
                  onSelect={(date) => {
                    if (date) setFormData({ ...formData, transactionDate: format(date, 'yyyy-MM-dd') });
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add a note..."
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving...' : transaction ? 'Save Changes' : 'Add Transaction'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
