import { Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/CurrencyContext';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FinanceAccount } from '@/lib/finance';

interface AccountCardProps {
  account: FinanceAccount;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export function AccountCard({ account, onDelete, onUpdate }: AccountCardProps) {
  const { formatCurrency } = useCurrency();
  const [isEditing, setIsEditing] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(String(account.initial_balance ?? 0));
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ initial_balance: parseFloat(openingBalance) || 0 })
        .eq('id', account.id);

      if (error) throw error;
      toast.success('Opening balance updated');
      setIsEditing(false);
      onUpdate();
    } catch {
      toast.error('Failed to update opening balance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative p-4 rounded-xl border border-border overflow-hidden group min-h-[160px]"
      style={{ backgroundColor: `${account.color || '#CBD5E1'}10` }}
    >
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-20" style={{ backgroundColor: account.color || '#CBD5E1' }} />
      <div className="relative h-full flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{account.icon}</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing((current) => !current)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary h-8 w-8"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(account.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-8 w-8"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="font-medium text-foreground">{account.name}</p>
          <p className="text-xs text-muted-foreground">{account.type}</p>
        </div>

        {isEditing ? (
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="sm" className="h-8 px-2" onClick={handleUpdate} disabled={loading}>
              Save
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Live Balance</p>
            <p className="text-xl font-bold" style={{ color: account.color || undefined }}>
              {formatCurrency(account.computed_balance)}
            </p>
            <p className="text-xs text-muted-foreground">
              Opening: {formatCurrency(Number(account.initial_balance ?? 0))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
