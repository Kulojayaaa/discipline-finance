import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronUp, Check, Trash2, Calendar } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/CurrencyContext';

interface EmiCardProps {
  emi: Tables<'emis'>;
  payments: Tables<'emi_payments'>[];
  onPaymentToggle: (paymentId: string, isPaid: boolean) => void;
  onDelete: (emiId: string) => void;
}

export function EmiCard({ emi, payments, onPaymentToggle, onDelete }: EmiCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { formatCurrency } = useCurrency();

  const paidPayments = payments.filter(p => p.is_paid);
  const progress = (paidPayments.length / payments.length) * 100;
  const totalPaid = paidPayments.reduce((sum, p) => sum + Number(p.principal_component) + Number(p.interest_component), 0);
  const totalAmount = Number(emi.emi_amount) * emi.total_months;
  const remainingAmount = totalAmount - totalPaid;

  const nextPayment = payments.find(p => !p.is_paid);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{emi.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(Number(emi.principal_amount))} @ {Number(emi.interest_rate)}% p.a.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={progress === 100 ? 'default' : 'secondary'}>
              {paidPayments.length}/{emi.total_months}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(emi.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Monthly EMI</p>
            <p className="font-bold text-primary">{formatCurrency(Number(emi.emi_amount))}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Paid</p>
            <p className="font-bold text-success">{formatCurrency(totalPaid)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Remaining</p>
            <p className="font-bold text-foreground">{formatCurrency(remainingAmount)}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {nextPayment && (
          <div className="p-3 bg-warning/10 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-warning" />
              <span className="text-sm">
                Next due: <span className="font-medium">{format(new Date(nextPayment.due_date), 'MMM d, yyyy')}</span>
              </span>
            </div>
            <Button 
              size="sm" 
              onClick={() => onPaymentToggle(nextPayment.id, nextPayment.is_paid)}
              className="bg-success hover:bg-success/90"
            >
              <Check className="w-4 h-4 mr-1" /> Mark Paid
            </Button>
          </div>
        )}

        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
          {expanded ? 'Hide' : 'View'} Payment Schedule
        </Button>

        {expanded && (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {payments.map((payment) => (
              <div 
                key={payment.id}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg text-sm',
                  payment.is_paid ? 'bg-success/10' : 'bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-medium">
                    {payment.month_number}
                  </span>
                  <div>
                    <p className="font-medium">{format(new Date(payment.due_date), 'MMM yyyy')}</p>
                    <p className="text-xs text-muted-foreground">
                      P: {formatCurrency(Number(payment.principal_component))} | 
                      I: {formatCurrency(Number(payment.interest_component))}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={payment.is_paid ? 'default' : 'outline'}
                  className={cn(payment.is_paid && 'bg-success hover:bg-success/90')}
                  onClick={() => onPaymentToggle(payment.id, payment.is_paid)}
                >
                  {payment.is_paid ? <Check className="w-4 h-4" /> : 'Pay'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
