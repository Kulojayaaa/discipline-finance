import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Receipt, AlertTriangle, CheckCircle } from 'lucide-react';
import { AddBillDialog } from '@/components/expenses/AddBillDialog';
import { BillCard } from '@/components/expenses/BillCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { isBefore, startOfDay } from 'date-fns';
import { useCurrency } from '@/hooks/CurrencyContext';

interface Bill {
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
}

export default function BillsPage() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchBills();
  }, [user]);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('due_date');
      if (error) throw error;
      setBills(data || []);
    } catch (error: any) {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const deleteBill = async (id: string) => {
    try {
      await supabase.from('bill_payment_history').delete().eq('bill_id', id);
      const { error } = await supabase.from('bills').delete().eq('id', id);
      if (error) throw error;
      toast.success('Bill deleted');
      fetchBills();
    } catch (error: any) {
      toast.error('Failed to delete bill');
    }
  };

  const today = startOfDay(new Date());
  const unpaid = bills.filter(b => !b.is_paid);
  const paid = bills.filter(b => b.is_paid);
  const overdue = unpaid.filter(b => isBefore(new Date(b.due_date), today));
  const upcoming = unpaid.filter(b => !isBefore(new Date(b.due_date), today));
  const totalDue = unpaid.reduce((s, b) => s + Number(b.amount), 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Receipt className="w-8 h-8 text-primary" />
              Bills & Payments
            </h1>
            <p className="text-muted-foreground">Track recurring bills and payment reminders</p>
          </div>
          <AddBillDialog onBillAdded={fetchBills} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-500">{overdue.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Due</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalDue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-green-500">{paid.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="unpaid">
          <TabsList>
            <TabsTrigger value="unpaid">
              Unpaid <Badge variant="secondary" className="ml-1">{unpaid.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="paid">
              Paid <Badge variant="secondary" className="ml-1">{paid.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unpaid">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
              </div>
            ) : unpaid.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">All bills paid! 🎉</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {unpaid.map((bill) => (
                  <BillCard key={bill.id} bill={bill} onDelete={deleteBill} onRefresh={fetchBills} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="paid">
            {paid.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">No paid bills yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {paid.map((bill) => (
                  <BillCard key={bill.id} bill={bill} onDelete={deleteBill} onRefresh={fetchBills} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
