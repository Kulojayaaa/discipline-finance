import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trash2, Check, Calendar, Bell, RotateCw, ChevronDown, History } from 'lucide-react';
import { format, differenceInDays, addMonths, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/CurrencyContext';

interface PaymentHistory {
  id: string;
  paid_date: string;
  amount: number;
}

interface BillCardProps {
  bill: {
    id: string;
    name: string;
    provider: string | null;
    amount: number;
    due_date: string;
    billing_cycle: string;
    is_recurring: boolean;
    reminder_days_before: number | null;
    last_paid_date: string | null;
    is_paid: boolean;
    notes: string | null;
    icon: string | null;
    color: string | null;
  };
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function BillCard({ bill, onDelete, onRefresh }: BillCardProps) {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [marking, setMarking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const dueDate = new Date(bill.due_date);
  const daysUntilDue = differenceInDays(dueDate, new Date());
  const reminderDays = bill.reminder_days_before || 3;

  useEffect(() => {
    if (showHistory && paymentHistory.length === 0) {
      fetchHistory();
    }
  }, [showHistory]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('bill_payment_history')
        .select('*')
        .eq('bill_id', bill.id)
        .order('paid_date', { ascending: false });

      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (error: any) {
      toast.error('Failed to load payment history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getStatusBadge = () => {
    if (bill.is_paid) {
      return <Badge className="bg-green-500/10 text-green-500 border-0">Paid</Badge>;
    }
    if (daysUntilDue < 0) {
      return <Badge className="bg-red-500/10 text-red-500 border-0">{Math.abs(daysUntilDue)} days overdue</Badge>;
    }
    if (daysUntilDue <= reminderDays) {
      return <Badge className="bg-orange-500/10 text-orange-500 border-0">Due in {daysUntilDue} days</Badge>;
    }
    return <Badge className="bg-blue-500/10 text-blue-500 border-0">Due in {daysUntilDue} days</Badge>;
  };

  const getNextDueDate = (currentDate: Date, cycle: string): Date => {
    switch (cycle) {
      case 'quarterly':
        return addMonths(currentDate, 3);
      case 'half-yearly':
        return addMonths(currentDate, 6);
      case 'yearly':
        return addMonths(currentDate, 12);
      default:
        return addMonths(currentDate, 1);
    }
  };

  const handleMarkPaid = async () => {
    if (!user) return;
    setMarking(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Save to payment history
      const { error: historyError } = await supabase
        .from('bill_payment_history')
        .insert({
          bill_id: bill.id,
          user_id: user.id,
          paid_date: today,
          amount: bill.amount,
        });

      if (historyError) throw historyError;
      
      if (bill.is_recurring) {
        // For recurring bills, update to next due date
        const nextDue = getNextDueDate(new Date(bill.due_date), bill.billing_cycle);
        const { error } = await supabase
          .from('bills')
          .update({
            last_paid_date: today,
            is_paid: false,
            due_date: nextDue.toISOString().split('T')[0],
          })
          .eq('id', bill.id);

        if (error) throw error;
        toast.success(`${bill.name} paid! Next due: ${format(nextDue, 'dd MMM yyyy')}`);
      } else {
        // For one-time bills, just mark as paid
        const { error } = await supabase
          .from('bills')
          .update({
            last_paid_date: today,
            is_paid: true,
          })
          .eq('id', bill.id);

        if (error) throw error;
        toast.success(`${bill.name} marked as paid!`);
      }
      
      setPaymentHistory([]);
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to update bill');
    } finally {
      setMarking(false);
    }
  };

  return (
    <Card className={`border-border hover:shadow-md transition-shadow ${bill.is_paid ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: `${bill.color || '#F59E0B'}20` }}
            >
              {bill.icon || '📄'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">{bill.name}</h4>
              {bill.provider && (
                <p className="text-sm text-muted-foreground">{bill.provider}</p>
              )}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDelete(bill.id)} 
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-foreground">{formatCurrency(bill.amount)}</span>
            {getStatusBadge()}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Due:</span>
            <span className="font-medium">{format(dueDate, 'dd MMM yyyy')}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <RotateCw className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground capitalize">{bill.billing_cycle}</span>
            {bill.is_recurring && <Badge variant="outline" className="text-xs">Recurring</Badge>}
          </div>

          {bill.last_paid_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4" />
              Last paid: {format(new Date(bill.last_paid_date), 'dd MMM yyyy')}
            </div>
          )}

          {!bill.is_paid && daysUntilDue <= reminderDays && daysUntilDue >= 0 && (
            <div className="flex items-center gap-2 text-sm text-orange-500">
              <Bell className="w-4 h-4" />
              Payment reminder!
            </div>
          )}
        </div>

        {!bill.is_paid && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-2"
            onClick={handleMarkPaid}
            disabled={marking}
          >
            <Check className="w-4 h-4" />
            {marking ? 'Marking...' : 'Mark as Paid'}
          </Button>
        )}

        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full mt-2 gap-2 text-muted-foreground">
              <History className="w-4 h-4" />
              Payment History
              <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            {loadingHistory ? (
              <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>
            ) : paymentHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No previous payments</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {paymentHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                    <span>{format(new Date(h.paid_date), 'dd MMM yyyy')}</span>
                    <span className="font-medium">{formatCurrency(h.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
