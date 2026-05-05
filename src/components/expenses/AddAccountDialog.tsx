import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const ACCOUNT_TYPES = ['Bank', 'Cash', 'Credit Card', 'Wallet', 'Investment'] as const;
const ACCOUNT_ICONS = ['💳', '🏦', '₹', '💸', '📱', '🪙'];
const ACCOUNT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const addAccountSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required'),
  type: z.string().min(1, 'Account type is required'),
  initialBalance: z.coerce.number().min(0, 'Opening balance cannot be negative').default(0),
  icon: z.string().min(1),
  color: z.string().min(1),
});

type AddAccountValues = z.infer<typeof addAccountSchema>;

interface AddAccountDialogProps {
  onAccountAdded: () => void;
}

export function AddAccountDialog({ onAccountAdded }: AddAccountDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const form = useForm<AddAccountValues>({
    resolver: zodResolver(addAccountSchema),
    defaultValues: {
      name: '',
      type: '',
      initialBalance: 0,
      icon: '💳',
      color: '#10B981',
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('accounts').insert({
        user_id: user.id,
        name: values.name,
        type: values.type,
        initial_balance: values.initialBalance,
        balance: 0,
        icon: values.icon,
        color: values.color,
      });

      if (error) throw error;

      toast.success('Account added successfully!');
      form.reset({
        name: '',
        type: '',
        initialBalance: 0,
        icon: '💳',
        color: '#10B981',
      });
      setOpen(false);
      onAccountAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add account');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input placeholder="e.g., HDFC Savings" {...form.register('name')} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Account Type</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.type && <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Opening Balance</Label>
            <Input type="number" step="0.01" {...form.register('initialBalance')} />
            {form.formState.errors.initialBalance && <p className="text-sm text-destructive">{form.formState.errors.initialBalance.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => form.setValue('icon', icon)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                    form.watch('icon') === icon ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue('color', color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    form.watch('color') === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Adding...' : 'Add Account'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
