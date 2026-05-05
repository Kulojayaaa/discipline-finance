import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, isPast, isToday, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { Plus, Bell, Check, Trash2, Clock, RefreshCw, Receipt } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/CurrencyContext';

const REMINDER_TYPES = ['general', 'payment', 'emi', 'birthday', 'meeting'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

function computeNextDate(dateStr: string, frequency: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  let next: Date;
  switch (frequency) {
    case 'daily':   next = addDays(date, 1); break;
    case 'weekly':  next = addWeeks(date, 1); break;
    case 'monthly': next = addMonths(date, 1); break;
    case 'yearly':  next = addYears(date, 1); break;
    default:        next = addDays(date, 1);
  }
  return format(next, 'yyyy-MM-dd');
}

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Tables<'reminders'>[]>([]);
  const [bills, setBills] = useState<Tables<'bills'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [activeTab, setActiveTab] = useState<'reminders' | 'bills'>('reminders');
  const [deletingReminder, setDeletingReminder] = useState<Tables<'reminders'> | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminder_date: format(new Date(), 'yyyy-MM-dd'),
    reminder_time: '',
    type: 'general',
    is_recurring: false,
    recurring_frequency: '',
  });
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    if (user) { fetchReminders(); fetchBills(); }
  }, [user]);

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('reminder_date')
        .order('reminder_time');
      if (error) throw error;
      setReminders(data || []);
    } catch {
      toast.error('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase.from('bills').select('*').order('due_date');
      if (error) throw error;
      setBills(data || []);
    } catch {
      toast.error('Failed to load bills');
    }
  };

  const addReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title) return;
    try {
      const { error } = await supabase.from('reminders').insert({
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        reminder_date: formData.reminder_date,
        reminder_time: formData.reminder_time || null,
        type: formData.type,
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.is_recurring ? formData.recurring_frequency : null,
      });
      if (error) throw error;
      toast.success('Reminder added!');
      setFormData({ title: '', description: '', reminder_date: format(new Date(), 'yyyy-MM-dd'), reminder_time: '', type: 'general', is_recurring: false, recurring_frequency: '' });
      setShowAddDialog(false);
      fetchReminders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add reminder');
    }
  };

  const toggleComplete = async (id: string, currentCompleted: boolean) => {
    try {
      const reminder = reminders.find(r => r.id === id);
      if (!reminder) return;

      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: !currentCompleted })
        .eq('id', id);
      if (error) throw error;

      // If marking complete and it's recurring, create next occurrence
      if (!currentCompleted && reminder.is_recurring && reminder.recurring_frequency) {
        const nextDate = computeNextDate(reminder.reminder_date, reminder.recurring_frequency);
        const { error: insertError } = await supabase.from('reminders').insert({
          user_id: reminder.user_id,
          title: reminder.title,
          description: reminder.description,
          reminder_date: nextDate,
          reminder_time: reminder.reminder_time,
          type: reminder.type,
          is_recurring: true,
          recurring_frequency: reminder.recurring_frequency,
          is_completed: false,
        });
        if (!insertError) {
          toast.success(`Reminder completed! Next occurrence: ${format(new Date(nextDate + 'T00:00:00'), 'dd MMM yyyy')}`);
        }
      }

      fetchReminders();
    } catch {
      toast.error('Failed to update reminder');
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', id);
      if (error) throw error;
      toast.success('Reminder deleted');
      setDeletingReminder(null);
      fetchReminders();
    } catch {
      toast.error('Failed to delete reminder');
    }
  };

  const filteredReminders = reminders.filter((r) => {
    if (filter === 'pending') return !r.is_completed;
    if (filter === 'completed') return r.is_completed;
    return true;
  });

  const filteredBills = bills.filter((b) => {
    if (filter === 'pending') return !b.is_paid;
    if (filter === 'completed') return b.is_paid;
    return true;
  });

  const getStatusColor = (reminder: Tables<'reminders'>) => {
    if (reminder.is_completed) return 'text-muted-foreground';
    const date = new Date(reminder.reminder_date);
    if (isPast(date) && !isToday(date)) return 'text-destructive';
    if (isToday(date)) return 'text-orange-500';
    return 'text-foreground';
  };

  const getBillStatusColor = (bill: Tables<'bills'>) => {
    if (bill.is_paid) return 'text-muted-foreground';
    const date = new Date(bill.due_date);
    if (isPast(date) && !isToday(date)) return 'text-destructive';
    if (isToday(date)) return 'text-orange-500';
    return 'text-foreground';
  };

  const pendingRemindersCount = reminders.filter(r => !r.is_completed).length;
  const pendingBillsCount = bills.filter(b => !b.is_paid).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reminders</h1>
            <p className="text-muted-foreground">Never miss important dates and tasks</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="gradient-sunset">
                <Plus className="w-4 h-4 mr-2" />
                Add Reminder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Reminder</DialogTitle>
              </DialogHeader>
              <form onSubmit={addReminder} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Reminder title" required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REMINDER_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={formData.reminder_date} onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Time (Optional)</Label>
                    <Input type="time" value={formData.reminder_time} onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Recurring</Label>
                  <Switch checked={formData.is_recurring} onCheckedChange={(v) => setFormData({ ...formData, is_recurring: v })} />
                </div>
                {formData.is_recurring && (
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={formData.recurring_frequency} onValueChange={(v) => setFormData({ ...formData, recurring_frequency: v })}>
                      <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((freq) => (
                          <SelectItem key={freq} value={freq} className="capitalize">{freq}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Add details..." rows={3} />
                </div>
                <Button type="submit" className="w-full">Add Reminder</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'reminders' | 'bills')}>
          <TabsList className="mb-4">
            <TabsTrigger value="reminders" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Reminders
              {pendingRemindersCount > 0 && (
                <Badge variant="secondary" className="text-xs">{pendingRemindersCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bills" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Bills Due
              {pendingBillsCount > 0 && (
                <Badge variant="destructive" className="text-xs">{pendingBillsCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2 mb-4">
            {(['pending', 'completed', 'all'] as const).map((f) => (
              <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
                {f}
              </Button>
            ))}
          </div>

          <TabsContent value="reminders" className="mt-0">
            {filteredReminders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {filter === 'pending' ? 'No pending reminders' : 'No reminders found'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredReminders.map((reminder) => (
                  <Card key={reminder.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={reminder.is_completed || false}
                          onCheckedChange={() => toggleComplete(reminder.id, reminder.is_completed || false)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={cn('font-medium', getStatusColor(reminder), reminder.is_completed && 'line-through')}>
                              {reminder.title}
                            </h3>
                            {reminder.is_recurring && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          {reminder.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{reminder.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Bell className="w-3 h-3" />
                              {format(new Date(reminder.reminder_date), 'dd MMM yyyy')}
                            </span>
                            {reminder.reminder_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {reminder.reminder_time}
                              </span>
                            )}
                            <span className="capitalize px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{reminder.type}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingReminder(reminder)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bills" className="mt-0">
            {filteredBills.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {filter === 'pending' ? 'No pending bills' : 'No bills found'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredBills.map((bill) => {
                  const dueDate = new Date(bill.due_date);
                  const isOverdue = isPast(dueDate) && !isToday(dueDate) && !bill.is_paid;
                  const isDueToday = isToday(dueDate) && !bill.is_paid;
                  return (
                    <Card key={bill.id} className={cn('group', bill.is_paid && 'opacity-60')}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: `${bill.color || '#F59E0B'}20` }}>
                            {bill.icon || '📄'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={cn('font-medium', getBillStatusColor(bill), bill.is_paid && 'line-through')}>
                                {bill.name}
                              </h3>
                              {bill.is_recurring && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
                              {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                              {isDueToday && <Badge className="bg-orange-500/10 text-orange-500 border-0 text-xs">Due Today</Badge>}
                              {bill.is_paid && <Badge className="bg-green-500/10 text-green-500 border-0 text-xs">Paid</Badge>}
                            </div>
                            {bill.provider && <p className="text-sm text-muted-foreground mb-2">{bill.provider}</p>}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 font-semibold text-foreground">{formatCurrency(bill.amount)}</span>
                              <span className="flex items-center gap-1"><Receipt className="w-3 h-3" />Due: {format(dueDate, 'dd MMM yyyy')}</span>
                              <span className="capitalize px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{bill.billing_cycle}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center mt-4">Manage bills from the Expenses page</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingReminder} onOpenChange={(open) => { if (!open) setDeletingReminder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingReminder?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingReminder && deleteReminder(deletingReminder.id)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
