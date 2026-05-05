import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import { Calendar, Bell, CreditCard, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'event' | 'reminder' | 'emi';
  color: string;
}

export function UpcomingEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchUpcomingEvents();
  }, [user]);

  const fetchUpcomingEvents = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      // Fetch calendar events
      const { data: calendarEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', today)
        .lte('event_date', nextWeek)
        .order('event_date')
        .limit(5);

      // Fetch reminders
      const { data: reminders } = await supabase
        .from('reminders')
        .select('*')
        .eq('is_completed', false)
        .gte('reminder_date', today)
        .lte('reminder_date', nextWeek)
        .order('reminder_date')
        .limit(5);

      // Fetch upcoming EMI payments
      const { data: emiPayments } = await supabase
        .from('emi_payments')
        .select('*')
        .eq('is_paid', false)
        .gte('due_date', today)
        .lte('due_date', nextWeek)
        .order('due_date')
        .limit(5);

      const emiIds = [...new Set((emiPayments || []).map((payment) => payment.emi_id))];
      const { data: emiRecords } = emiIds.length > 0
        ? await supabase.from('emis').select('id, name').in('id', emiIds)
        : { data: [] as Array<{ id: string; name: string }> };
      const emiNameMap = new Map((emiRecords || []).map((entry) => [entry.id, entry.name]));

      const allEvents: Event[] = [];

      calendarEvents?.forEach((e) => {
        allEvents.push({
          id: e.id,
          title: e.title,
          date: e.event_date,
          time: e.start_time || undefined,
          type: 'event',
          color: e.color || '#8B5CF6',
        });
      });

      reminders?.forEach((r) => {
        allEvents.push({
          id: r.id,
          title: r.title,
          date: r.reminder_date,
          time: r.reminder_time || undefined,
          type: 'reminder',
          color: r.color || '#F97316',
        });
      });

      emiPayments?.forEach((p) => {
        allEvents.push({
          id: p.id,
          title: `EMI: ${emiNameMap.get(p.emi_id) || 'Payment'}`,
          date: p.due_date,
          type: 'emi',
          color: '#EF4444',
        });
      });

      // Sort by date and time
      allEvents.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return 0;
      });

      setEvents(allEvents.slice(0, 5));
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, dd MMM');
  };

  const getIcon = (type: Event['type']) => {
    switch (type) {
      case 'reminder':
        return Bell;
      case 'emi':
        return CreditCard;
      default:
        return Calendar;
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Upcoming Events</CardTitle>
        <Link to="/calendar" className="text-sm text-primary hover:underline">
          View Calendar
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No upcoming events this week</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const Icon = getIcon(event.type);
              return (
                <div
                  key={`${event.type}-${event.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${event.color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: event.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{event.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={cn(
                        isToday(parseISO(event.date)) && 'text-primary font-medium'
                      )}>
                        {getDateLabel(event.date)}
                      </span>
                      {event.time && (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>{event.time}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: event.color }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
