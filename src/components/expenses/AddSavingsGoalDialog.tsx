import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Target } from 'lucide-react';
import { format } from 'date-fns';
import { FinanceAccount } from '@/lib/finance';

const icons = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '👗', '💍', '🎓', '🏥', '₹', '🎁'];
const colors = ['#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

interface AddSavingsGoalDialogProps {
  accounts: FinanceAccount[];
  onGoalAdded: () => void;
}

export function AddSavingsGoalDialog({ accounts, onGoalAdded }: AddSavingsGoalDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [accountId, setAccountId] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🎯');
  const [selectedColor, setSelectedColor] = useState('#EC4899');

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  const handleSubmit = async () => {
    if (!name.trim() || !targetAmount || !accountId) {
      toast.error('Please fill in the required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('savings_goals').insert({
        user_id: user?.id,
        name: name.trim(),
        target_amount: Number(targetAmount),
        current_amount: 0,
        deadline: deadline || null,
        account_id: accountId,
        icon: selectedIcon,
        color: selectedColor,
      });

      if (error) throw error;
      toast.success('Savings goal created!');
      setOpen(false);
      setName('');
      setTargetAmount('');
      setDeadline('');
      setAccountId(accounts[0]?.id || '');
      onGoalAdded();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Target className="w-4 h-4 mr-2" />
          Add Goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Savings Goal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Goal Name *</Label>
            <Input
              placeholder="e.g., Emergency Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Linked Account *</Label>
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

          <div className="space-y-2">
            <Label>Target Amount *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="100000"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Target Date</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {icons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-10 h-10 rounded-lg border text-xl flex items-center justify-center transition-all ${
                    selectedIcon === icon ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !accountId} className="flex-1">
              {loading ? 'Creating...' : 'Create Goal'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
