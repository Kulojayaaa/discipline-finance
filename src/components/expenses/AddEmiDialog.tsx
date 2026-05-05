import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';
import { useCurrency } from '@/hooks/CurrencyContext';
import { FinanceAccount } from '@/lib/finance';

interface AddEmiDialogProps {
  accounts: FinanceAccount[];
  onEmiAdded: () => void;
}

export function AddEmiDialog({ accounts, onEmiAdded }: AddEmiDialogProps) {
  const { user } = useAuth();
  const { formatCurrency, currencySymbol } = useCurrency();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [totalMonths, setTotalMonths] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDay, setDueDay] = useState('1');
  const [accountId, setAccountId] = useState('');
  const [autoCreateTransaction, setAutoCreateTransaction] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  const calculateEmi = (principal: number, rate: number, months: number) => {
    if (rate === 0) return principal / months;
    const monthlyRate = rate / 12 / 100;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    return emi;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const principal = parseFloat(principalAmount);
      const rate = parseFloat(interestRate);
      const months = parseInt(totalMonths);
      if (!accountId) throw new Error('Please link an account for EMI payments');
      const emiAmount = calculateEmi(principal, rate, months);

      // Create EMI record
      const { data: emiData, error: emiError } = await supabase
        .from('emis')
        .insert({
          user_id: user.id,
          name,
          principal_amount: principal,
          interest_rate: rate,
          total_months: months,
          emi_amount: emiAmount,
          start_date: startDate,
          due_day: parseInt(dueDay),
          notes: notes || null,
          account_id: accountId,
          auto_create_transaction: autoCreateTransaction,
          next_due_date: startDate,
        })
        .select()
        .single();

      if (emiError) throw emiError;

      // Create EMI payments for each month
      const payments = [];
      let remainingPrincipal = principal;
      const monthlyRate = rate / 12 / 100;

      for (let i = 0; i < months; i++) {
        const interestComponent = remainingPrincipal * monthlyRate;
        const principalComponent = emiAmount - interestComponent;
        remainingPrincipal -= principalComponent;

        const dueDate = addMonths(new Date(startDate), i);
        dueDate.setDate(parseInt(dueDay));

        payments.push({
          emi_id: emiData.id,
          user_id: user.id,
          month_number: i + 1,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          principal_component: principalComponent,
          interest_component: interestComponent,
          is_paid: false,
        });
      }

      const { error: paymentsError } = await supabase.from('emi_payments').insert(payments);
      if (paymentsError) throw paymentsError;

      // Create reminders for each EMI payment
      const reminders = payments.map((payment) => ({
        user_id: user.id,
        title: `EMI Due: ${name}`,
        description: `EMI payment of ${formatCurrency(emiAmount)} is due`,
        reminder_date: payment.due_date,
        type: 'payment',
        color: '#EF4444',
        is_recurring: false,
      }));

      const { error: remindersError } = await supabase.from('reminders').insert(reminders);
      if (remindersError) console.error('Failed to create reminders:', remindersError);

      toast.success('EMI created successfully!');
      setOpen(false);
      resetForm();
      onEmiAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create EMI');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPrincipalAmount('');
    setInterestRate('');
    setTotalMonths('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setDueDay('1');
    setAccountId('');
    setAutoCreateTransaction(true);
    setNotes('');
  };

  const previewEmi = () => {
    if (!principalAmount || !interestRate || !totalMonths) return null;
    const emi = calculateEmi(parseFloat(principalAmount), parseFloat(interestRate), parseInt(totalMonths));
    const totalPayable = emi * parseInt(totalMonths);
    const totalInterest = totalPayable - parseFloat(principalAmount);
    return { emi, totalPayable, totalInterest };
  };

  const preview = previewEmi();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary text-white">
          <Plus className="w-4 h-4 mr-2" /> Add EMI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New EMI</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">EMI Name</Label>
            <Input
              id="name"
              placeholder="e.g., Home Loan, Car Loan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="principal">Principal Amount ({currencySymbol})</Label>
              <Input
                id="principal"
                type="number"
                placeholder="100000"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Interest Rate (% p.a.)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                placeholder="12"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="months">Total Months</Label>
              <Input
                id="months"
                type="number"
                placeholder="12"
                value={totalMonths}
                onChange={(e) => setTotalMonths(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDay">Due Day of Month</Label>
              <Input
                id="dueDay"
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
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

          <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="auto-emi">Auto-create due transactions</Label>
              <p className="text-xs text-muted-foreground">Due EMI payments post as linked debit transactions.</p>
            </div>
            <Switch id="auto-emi" checked={autoCreateTransaction} onCheckedChange={setAutoCreateTransaction} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {preview && (
            <div className="p-4 bg-primary/10 rounded-lg space-y-2">
              <h4 className="font-medium text-foreground">EMI Preview</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Monthly EMI</p>
                  <p className="font-bold text-primary">{formatCurrency(preview.emi)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Interest</p>
                  <p className="font-bold text-warning">{formatCurrency(preview.totalInterest)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Payable</p>
                  <p className="font-bold text-foreground">{formatCurrency(preview.totalPayable)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !accountId} className="gradient-primary text-white">
              {loading ? 'Creating...' : 'Create EMI'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
