import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Receipt, Plus } from 'lucide-react';
import { useCurrency } from '@/hooks/CurrencyContext';

const BILL_TYPES = [
  { name: 'Mobile Recharge', icon: '📱' },
  { name: 'DTH/Cable', icon: '📺' },
  { name: 'Electricity', icon: '⚡' },
  { name: 'Water', icon: '💧' },
  { name: 'Gas', icon: '🔥' },
  { name: 'Internet', icon: '🌐' },
  { name: 'Rent', icon: '🏠' },
  { name: 'Insurance', icon: '🛡️' },
  { name: 'Subscription', icon: '📦' },
  { name: 'Other', icon: '📄' },
];

const BILLING_CYCLES = ['monthly', 'quarterly', 'half-yearly', 'yearly'];

interface AddBillDialogProps {
  onBillAdded: () => void;
}

export function AddBillDialog({ onBillAdded }: AddBillDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(true);
  const [selectedType, setSelectedType] = useState(BILL_TYPES[0].name);
  const { currencySymbol } = useCurrency();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string || selectedType;
    const provider = formData.get('provider') as string;
    const amount = formData.get('amount') as string;
    const dueDate = formData.get('dueDate') as string;
    const billingCycle = formData.get('billingCycle') as string;
    const reminderDays = formData.get('reminderDays') as string;
    const notes = formData.get('notes') as string;

    if (!amount || !dueDate) {
      toast.error('Please fill required fields');
      return;
    }

    const selectedIcon = BILL_TYPES.find(t => t.name === selectedType)?.icon || '📄';

    setLoading(true);
    try {
      const { error } = await supabase.from('bills').insert({
        user_id: user.id,
        name: name || selectedType,
        provider: provider || null,
        amount: parseFloat(amount),
        due_date: dueDate,
        billing_cycle: billingCycle || 'monthly',
        is_recurring: isRecurring,
        reminder_days_before: reminderDays ? parseInt(reminderDays) : 3,
        notes: notes || null,
        icon: selectedIcon,
      });

      if (error) throw error;
      toast.success('Bill added!');
      setOpen(false);
      onBillAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add bill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Receipt className="w-4 h-4" />
          <Plus className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Add Bill
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="billType">Bill Type *</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILL_TYPES.map(type => (
                  <SelectItem key={type.name} value={type.name}>
                    {type.icon} {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="name">Custom Name (optional)</Label>
            <Input id="name" name="name" placeholder={`e.g., ${selectedType}`} />
          </div>

          <div>
            <Label htmlFor="provider">Provider</Label>
            <Input id="provider" name="provider" placeholder="e.g., Airtel, Tata Power" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount ({currencySymbol}) *</Label>
              <Input id="amount" name="amount" type="number" step="0.01" placeholder="e.g., 500" required />
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input id="dueDate" name="dueDate" type="date" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="billingCycle">Billing Cycle</Label>
              <Select name="billingCycle" defaultValue="monthly">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map(cycle => (
                    <SelectItem key={cycle} value={cycle} className="capitalize">{cycle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reminderDays">Remind Before (days)</Label>
              <Input id="reminderDays" name="reminderDays" type="number" defaultValue="3" min="1" max="30" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isRecurring">Recurring Bill</Label>
            <Switch id="isRecurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Any additional notes..." rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : 'Add Bill'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
