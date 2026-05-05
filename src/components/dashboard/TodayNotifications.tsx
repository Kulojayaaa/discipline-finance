import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { 
  Bell, 
  Calendar, 
  CreditCard, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';
import { useCurrency } from '@/hooks/CurrencyContext';

interface TodayItem {
  id: string;
  title: string;
  type: 'reminder' | 'event' | 'bill' | 'emi';
  time?: string;
  amount?: number;
  isOverdue?: boolean;
}

export const useTodayNotifications = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    if (user && !hasShown) {
      fetchAndShowNotifications();
      setHasShown(true);
    }
  }, [user, hasShown]);

  const fetchAndShowNotifications = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayStart = startOfDay(new Date());

      // Fetch today's reminders
      const { data: reminders } = await supabase
        .from('reminders')
        .select('id, title, reminder_time')
        .eq('reminder_date', today)
        .eq('is_completed', false);

      // Fetch today's calendar events
      const { data: events } = await supabase
        .from('calendar_events')
        .select('id, title, start_time')
        .eq('event_date', today);

      // Fetch bills due today or overdue
      const { data: bills } = await supabase
        .from('bills')
        .select('id, name, amount, due_date')
        .eq('is_paid', false)
        .lte('due_date', today);

      // Fetch EMI payments due today or overdue
      const { data: emis } = await supabase
        .from('emi_payments')
        .select('id, emi_id, due_date, principal_component, interest_component')
        .eq('is_paid', false)
        .lte('due_date', today);

      const emiIds = [...new Set((emis || []).map((entry) => entry.emi_id))];
      const { data: emiRecords } = emiIds.length > 0
        ? await supabase.from('emis').select('id, name').in('id', emiIds)
        : { data: [] as Array<{ id: string; name: string }> };
      const emiNameMap = new Map((emiRecords || []).map((entry) => [entry.id, entry.name]));

      const items: TodayItem[] = [];

      // Add reminders
      reminders?.forEach(r => {
        items.push({
          id: r.id,
          title: r.title,
          type: 'reminder',
          time: r.reminder_time || undefined,
        });
      });

      // Add events
      events?.forEach(e => {
        items.push({
          id: e.id,
          title: e.title,
          type: 'event',
          time: e.start_time || undefined,
        });
      });

      // Add bills
      bills?.forEach(b => {
        const isOverdue = isBefore(new Date(b.due_date), todayStart);
        items.push({
          id: b.id,
          title: b.name,
          type: 'bill',
          amount: b.amount,
          isOverdue,
        });
      });

      // Add EMIs
      emis?.forEach(e => {
        const isOverdue = isBefore(new Date(e.due_date), todayStart);
        const emiName = emiNameMap.get(e.emi_id) || 'EMI Payment';
        items.push({
          id: e.id,
          title: emiName,
          type: 'emi',
          amount: e.principal_component + e.interest_component,
          isOverdue,
        });
      });

      // Show notifications
      if (items.length > 0) {
        showNotifications(items);
      }
    } catch (error) {
      console.error('Error fetching today notifications:', error);
    }
  };

  const showNotifications = (items: TodayItem[]) => {
    // Group items by type
    const reminders = items.filter(i => i.type === 'reminder');
    const events = items.filter(i => i.type === 'event');
    const bills = items.filter(i => i.type === 'bill');
    const emis = items.filter(i => i.type === 'emi');
    const overdueItems = items.filter(i => i.isOverdue);

    // Show overdue notification first (high priority)
    if (overdueItems.length > 0) {
      setTimeout(() => {
        toast.error(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>Overdue Items!</span>
            </div>
            <div className="text-sm opacity-90">
              You have {overdueItems.length} overdue payment{overdueItems.length > 1 ? 's' : ''} that need attention
            </div>
          </div>,
          {
            duration: 8000,
            className: 'bg-destructive text-destructive-foreground border-destructive',
          }
        );
      }, 500);
    }

    // Show today's reminders
    if (reminders.length > 0) {
      setTimeout(() => {
        toast(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold text-blue-600">
              <Bell className="h-4 w-4" />
              <span>Today's Reminders</span>
            </div>
            <div className="text-sm space-y-1 mt-1">
              {reminders.slice(0, 3).map(r => (
                <div key={r.id} className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{r.title}</span>
                  {r.time && <span className="text-xs text-muted-foreground">at {r.time}</span>}
                </div>
              ))}
              {reminders.length > 3 && (
                <div className="text-xs text-muted-foreground">+{reminders.length - 3} more</div>
              )}
            </div>
          </div>,
          {
            duration: 6000,
            icon: null,
          }
        );
      }, 1500);
    }

    // Show today's events
    if (events.length > 0) {
      setTimeout(() => {
        toast(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold text-purple-600">
              <Calendar className="h-4 w-4" />
              <span>Today's Events</span>
            </div>
            <div className="text-sm space-y-1 mt-1">
              {events.slice(0, 3).map(e => (
                <div key={e.id} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                  <span>{e.title}</span>
                  {e.time && <span className="text-xs text-muted-foreground">at {e.time}</span>}
                </div>
              ))}
              {events.length > 3 && (
                <div className="text-xs text-muted-foreground">+{events.length - 3} more</div>
              )}
            </div>
          </div>,
          {
            duration: 6000,
            icon: null,
          }
        );
      }, 2500);
    }

    // Show bills due today (non-overdue)
    const todayBills = bills.filter(b => !b.isOverdue);
    if (todayBills.length > 0) {
      setTimeout(() => {
        const totalAmount = todayBills.reduce((sum, b) => sum + (b.amount || 0), 0);
        toast(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold text-orange-600">
              <CreditCard className="h-4 w-4" />
              <span>Bills Due Today</span>
            </div>
            <div className="text-sm space-y-1 mt-1">
              {todayBills.slice(0, 3).map(b => (
                <div key={b.id} className="flex items-center justify-between gap-2">
                  <span>{b.title}</span>
                  <span className="text-xs font-medium">{formatCurrency(b.amount || 0)}</span>
                </div>
              ))}
              {todayBills.length > 3 && (
                <div className="text-xs text-muted-foreground">+{todayBills.length - 3} more</div>
              )}
              <div className="pt-1 border-t text-xs font-semibold">
                Total: {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>,
          {
            duration: 6000,
            icon: null,
          }
        );
      }, 3500);
    }

    // Show EMIs due today (non-overdue)
    const todayEmis = emis.filter(e => !e.isOverdue);
    if (todayEmis.length > 0) {
      setTimeout(() => {
        const totalAmount = todayEmis.reduce((sum, e) => sum + (e.amount || 0), 0);
        toast(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold text-green-600">
              <CreditCard className="h-4 w-4" />
              <span>EMI Due Today</span>
            </div>
            <div className="text-sm space-y-1 mt-1">
              {todayEmis.slice(0, 3).map(e => (
                <div key={e.id} className="flex items-center justify-between gap-2">
                  <span>{e.title}</span>
                  <span className="text-xs font-medium">{formatCurrency(e.amount || 0)}</span>
                </div>
              ))}
              <div className="pt-1 border-t text-xs font-semibold">
                Total: {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>,
          {
            duration: 6000,
            icon: null,
          }
        );
      }, 4500);
    }
  };
};
