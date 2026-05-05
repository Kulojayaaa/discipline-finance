import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isBefore, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2, Bell, CreditCard, Calendar as CalendarIcon, PartyPopper, Star, Clock, Receipt } from 'lucide-react';
import { AddEventDialog } from '@/components/calendar/AddEventDialog';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/CurrencyContext';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarItem {
  id: string;
  title: string;
  date: string;
  color: string;
  type: 'event' | 'reminder' | 'emi' | 'bill';
  eventType?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  is_paid?: boolean;
  amount?: number;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('events');
  const { formatCurrency } = useCurrency();

  const today = startOfDay(new Date());

  useEffect(() => {
    if (user) fetchAllItems();
  }, [user, currentMonth]);

  const fetchAllItems = async () => {
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', start)
        .lte('event_date', end)
        .order('event_date');

      if (eventsError) throw eventsError;

      const { data: reminders, error: remindersError } = await supabase
        .from('reminders')
        .select('*')
        .gte('reminder_date', start)
        .lte('reminder_date', end)
        .order('reminder_date');

      if (remindersError) throw remindersError;

      const { data: emiPayments, error: emiError } = await supabase
        .from('emi_payments')
        .select('*')
        .gte('due_date', start)
        .lte('due_date', end)
        .order('due_date');

      if (emiError) throw emiError;

      const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .gte('due_date', start)
        .lte('due_date', end)
        .order('due_date');

      if (billsError) throw billsError;

      const emiIds = [...new Set((emiPayments || []).map((payment) => payment.emi_id))];
      const { data: emiRecords, error: emiNamesError } = emiIds.length > 0
        ? await supabase.from('emis').select('id, name').in('id', emiIds)
        : { data: [] as Array<{ id: string; name: string }>, error: null };

      if (emiNamesError) throw emiNamesError;

      const emiNameMap = new Map((emiRecords || []).map((entry) => [entry.id, entry.name]));

      const items: CalendarItem[] = [];

      events?.forEach((e) => {
        items.push({
          id: e.id, title: e.title, date: e.event_date,
          color: e.color || '#8B5CF6', type: 'event',
          eventType: e.event_type || 'general',
          description: e.description || undefined,
          start_time: e.start_time || undefined,
          end_time: e.end_time || undefined,
          all_day: e.all_day ?? true,
        });
      });

      reminders?.forEach((r) => {
        items.push({
          id: r.id, title: r.title, date: r.reminder_date,
          color: r.color || '#F97316', type: 'reminder',
          description: r.description || undefined,
          start_time: r.reminder_time || undefined,
        });
      });

      emiPayments?.forEach((p) => {
        items.push({
          id: p.id,
          title: `${emiNameMap.get(p.emi_id) || 'EMI'} - ${p.month_number}`,
          date: p.due_date,
          color: p.is_paid ? '#10B981' : '#EF4444',
          type: 'emi',
          description: p.is_paid ? 'Paid' : 'Pending',
          is_paid: p.is_paid ?? false,
        });
      });

      bills?.forEach((b) => {
        items.push({
          id: b.id, title: b.name, date: b.due_date,
          color: b.is_paid ? '#10B981' : (b.color || '#F59E0B'),
          type: 'bill',
          description: b.provider || undefined,
          is_paid: b.is_paid ?? false,
          amount: b.amount,
        });
      });

      setCalendarItems(items);
    } catch (error: any) {
      toast.error('Failed to load calendar items');
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (item: CalendarItem) => {
    try {
      if (item.type === 'event') {
        const { error } = await supabase.from('calendar_events').delete().eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'reminder') {
        const { error } = await supabase.from('reminders').delete().eq('id', item.id);
        if (error) throw error;
      }
      toast.success('Item deleted');
      fetchAllItems();
    } catch (error: any) {
      toast.error('Failed to delete item');
    }
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfMonth = startOfMonth(currentMonth).getDay();
  const emptyDays = Array(firstDayOfMonth).fill(null);

  const getItemsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarItems.filter(item => item.date === dateStr);
  };

  const selectedDateItems = selectedDate ? getItemsForDay(selectedDate) : [];

  const eventItems = calendarItems.filter(i => i.type === 'event');
  const reminderItems = calendarItems.filter(i => i.type === 'reminder');
  const emiItems = calendarItems.filter(i => i.type === 'emi');
  const billItems = calendarItems.filter(i => i.type === 'bill');

  const upcomingEvents = eventItems.filter(e => !isBefore(new Date(e.date), today));
  const pastEvents = eventItems.filter(e => isBefore(new Date(e.date), today));
  
  const upcomingBills = billItems.filter(b => !b.is_paid && !isBefore(new Date(b.date), today));
  const overdueBills = billItems.filter(b => !b.is_paid && isBefore(new Date(b.date), today));
  const paidBills = billItems.filter(b => b.is_paid);

  const getEventTypeIcon = (eventType?: string) => {
    switch (eventType) {
      case 'holiday': return <PartyPopper className="w-4 h-4 text-amber-500" />;
      case 'birthday': return <Star className="w-4 h-4 text-pink-500" />;
      case 'meeting': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'reminder': return <Bell className="w-4 h-4 text-green-500" />;
      default: return <CalendarIcon className="w-4 h-4 text-primary" />;
    }
  };

  const getItemIcon = (item: CalendarItem) => {
    if (item.type === 'event') return getEventTypeIcon(item.eventType);
    if (item.type === 'reminder') return <Bell className="w-4 h-4 text-orange-500" />;
    if (item.type === 'bill') return <Receipt className="w-4 h-4" style={{ color: item.color }} />;
    return <CreditCard className="w-4 h-4" style={{ color: item.color }} />;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'event': return 'from-violet-500/20 to-purple-500/10 border-violet-500/30';
      case 'reminder': return 'from-orange-500/20 to-amber-500/10 border-orange-500/30';
      case 'bill': return 'from-amber-500/20 to-yellow-500/10 border-amber-500/30';
      case 'emi': return 'from-red-500/20 to-rose-500/10 border-red-500/30';
      default: return 'from-muted/50 to-muted/30 border-border';
    }
  };

  const renderEventList = (items: CalendarItem[], showDelete = true) => {
    if (items.length === 0) {
      return <p className="text-muted-foreground text-sm text-center py-4">No items</p>;
    }

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={`${item.type}-${item.id}`}
            className={cn(
              "p-3 rounded-xl border group relative transition-all duration-200 cursor-pointer",
              "bg-gradient-to-r hover:shadow-md hover:scale-[1.01]",
              getTypeColor(item.type)
            )}
            onClick={() => setSelectedDate(new Date(item.date))}
          >
            {showDelete && item.type !== 'emi' && item.type !== 'bill' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-background/60 flex items-center justify-center">
                {getItemIcon(item)}
              </div>
              <p className="font-medium text-foreground text-sm pr-6 truncate">{item.title}</p>
            </div>
            <div className="flex items-center gap-2 mt-1.5 ml-9">
              <span className="text-xs text-muted-foreground">
                {format(new Date(item.date), 'dd MMM')}
              </span>
              {item.eventType && item.type === 'event' && (
                <Badge variant="secondary" className="text-xs capitalize rounded-full">
                  {item.eventType}
                </Badge>
              )}
              {item.type === 'emi' && (
                <Badge variant={item.is_paid ? 'default' : 'destructive'} className="text-xs rounded-full">
                  {item.is_paid ? '✓ Paid' : '⏰ Due'}
                </Badge>
              )}
              {item.type === 'bill' && (
                <>
                  {item.amount && <span className="text-xs font-semibold">{formatCurrency(item.amount)}</span>}
                  <Badge variant={item.is_paid ? 'default' : 'destructive'} className="text-xs rounded-full">
                    {item.is_paid ? '✓ Paid' : '⏰ Due'}
                  </Badge>
                </>
              )}
            </div>
            {!item.all_day && item.start_time && (
              <p className="text-xs text-muted-foreground mt-1 ml-9">
                {item.start_time}{item.end_time ? ` - ${item.end_time}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
            <p className="text-muted-foreground">Manage events, reminders & EMI payments</p>
          </div>
          <Button
            className="gradient-primary text-white shadow-glow"
            onClick={() => { setSelectedDate(new Date()); setShowAddDialog(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Calendar Grid */}
          <Card className="xl:col-span-2 overflow-hidden">
            {/* Gradient Header */}
            <div className="gradient-primary p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/20" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/20" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((day, index) => {
                  const isWeekend = index === 0 || index === 6;
                  return (
                    <div
                      key={day}
                      className={cn(
                        "text-center text-xs font-semibold py-2 rounded-lg",
                        isWeekend ? "text-orange-500 bg-orange-500/5" : "text-muted-foreground"
                      )}
                    >
                      {day}
                    </div>
                  );
                })}
                {emptyDays.map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {days.map((day) => {
                  const dayItems = getItemsForDay(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const dayOfWeek = day.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        'aspect-square p-0.5 rounded-xl transition-all duration-200 relative flex flex-col items-center justify-start pt-1 group',
                        isSelected && 'bg-primary/20 ring-2 ring-primary shadow-md',
                        isToday && !isSelected && 'bg-gradient-to-br from-primary/10 to-primary/5',
                        isWeekend && !isSelected && !isToday && 'bg-orange-500/5',
                        !isSelected && !isToday && !isWeekend && 'hover:bg-accent/50',
                      )}
                    >
                      <span className={cn(
                        'text-sm w-7 h-7 flex items-center justify-center rounded-full transition-all',
                        isToday && 'bg-primary text-white font-bold shadow-md animate-pulse',
                        isSelected && !isToday && 'bg-primary/30 font-bold',
                        isWeekend && !isToday && !isSelected && 'text-orange-500 font-medium'
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayItems.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayItems.slice(0, 3).map((item, i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-150"
                              style={{ backgroundColor: item.color }}
                            />
                          ))}
                          {dayItems.length > 3 && (
                            <span className="text-[7px] text-muted-foreground font-bold">+{dayItems.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-accent/50 to-accent/20 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground">{format(selectedDate, 'EEEE, dd MMMM yyyy')}</h3>
                    <Button size="sm" className="gradient-primary text-white" onClick={() => setShowAddDialog(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  {selectedDateItems.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No events for this day</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedDateItems.map((item) => (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-background/80 border border-border/50 backdrop-blur-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                              {getItemIcon(item)}
                            </div>
                            <span className="text-sm font-medium">{item.title}</span>
                          </div>
                          {item.type !== 'emi' && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => deleteItem(item)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side Panel */}
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                {format(currentMonth, 'MMMM')} Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 mb-4 bg-muted/50">
                  <TabsTrigger value="events" className="flex items-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg transition-all">
                    <CalendarIcon className="w-3 h-3" />
                    <span className="hidden sm:inline text-xs">Events</span>
                    <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 rounded-full">{eventItems.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="reminders" className="flex items-center gap-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-lg transition-all">
                    <Bell className="w-3 h-3" />
                    <span className="hidden sm:inline text-xs">Alerts</span>
                    <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 rounded-full">{reminderItems.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="bills" className="flex items-center gap-1 data-[state=active]:bg-amber-500 data-[state=active]:text-white rounded-lg transition-all">
                    <Receipt className="w-3 h-3" />
                    <span className="hidden sm:inline text-xs">Bills</span>
                    <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 rounded-full">{billItems.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="emi" className="flex items-center gap-1 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg transition-all">
                    <CreditCard className="w-3 h-3" />
                    <span className="hidden sm:inline text-xs">EMI</span>
                    <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 rounded-full">{emiItems.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="events" className="mt-0">
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {upcomingEvents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          Upcoming ({upcomingEvents.length})
                        </h4>
                        {renderEventList(upcomingEvents)}
                      </div>
                    )}
                    {pastEvents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                          Past ({pastEvents.length})
                        </h4>
                        {renderEventList(pastEvents)}
                      </div>
                    )}
                    {eventItems.length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-8">
                        No events this month. Click "Add Event" to create one.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="reminders" className="mt-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    {renderEventList(reminderItems)}
                  </div>
                </TabsContent>

                <TabsContent value="bills" className="mt-0">
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {overdueBills.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          Overdue ({overdueBills.length})
                        </h4>
                        {renderEventList(overdueBills, false)}
                      </div>
                    )}
                    {upcomingBills.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          Upcoming ({upcomingBills.length})
                        </h4>
                        {renderEventList(upcomingBills, false)}
                      </div>
                    )}
                    {paidBills.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Paid ({paidBills.length})
                        </h4>
                        {renderEventList(paidBills, false)}
                      </div>
                    )}
                    {billItems.length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-8">
                        No bills this month. Add bills from the Bills page.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="emi" className="mt-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    {renderEventList(emiItems, false)}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Legend */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-muted/50 to-muted/20 py-3 px-6">
            <div className="flex flex-wrap gap-5 justify-center">
              {[
                { icon: <CalendarIcon className="w-4 h-4 text-primary" />, label: 'General' },
                { icon: <PartyPopper className="w-4 h-4 text-amber-500" />, label: 'Holiday' },
                { icon: <Star className="w-4 h-4 text-pink-500" />, label: 'Birthday' },
                { icon: <Clock className="w-4 h-4 text-blue-500" />, label: 'Meeting' },
                { icon: <Bell className="w-4 h-4 text-orange-500" />, label: 'Reminder' },
                { icon: <Receipt className="w-4 h-4 text-amber-500" />, label: 'Bill' },
                { icon: <CreditCard className="w-4 h-4 text-red-500" />, label: 'EMI Due' },
                { icon: <CreditCard className="w-4 h-4 text-green-500" />, label: 'EMI Paid' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  {icon}
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {selectedDate && (
        <AddEventDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          selectedDate={selectedDate}
          onEventAdded={fetchAllItems}
        />
      )}
    </AppLayout>
  );
}
