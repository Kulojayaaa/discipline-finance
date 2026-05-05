import { useState } from 'react';
import { Target, Wallet, Calendar, FileText, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddHabitDialog } from '@/components/habits/AddHabitDialog';
import { AddTransactionDialog } from '@/components/expenses/AddTransactionDialog';
import { AddEventDialog } from '@/components/calendar/AddEventDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FinanceAccount } from '@/lib/finance';

export function QuickActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const { data: accounts = [] } = useQuery<FinanceAccount[]>({
    queryKey: ['accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((account: any) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        icon: account.icon ?? null,
        color: account.color ?? null,
        is_active: account.is_active ?? true,
        initial_balance: account.initial_balance ?? 0,
        legacy_balance: account.balance ?? 0,
        computed_balance: Number(account.initial_balance ?? account.balance ?? 0),
        created_at: account.created_at,
      }));
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const handleAddHabit = async (habit: any) => {
    const { error } = await supabase.from('habits').insert({
      user_id: user?.id,
      name: habit.name,
      description: habit.description,
      category: habit.category,
      frequency: habit.frequency,
      target_count: habit.targetCount,
      icon: habit.icon,
      color: habit.color,
      start_date: habit.startDate || null,
      end_date: habit.endDate || null,
      skip_weekends: habit.skipWeekends,
      skip_holidays: habit.skipHolidays,
      custom_skip_days: habit.customSkipDays,
      goal: habit.goal || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Habit created! 🎉');
      queryClient.invalidateQueries({ queryKey: ['habits', user?.id] });
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !noteTitle.trim()) return;

    setSavingNote(true);
    try {
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title: noteTitle,
        content: noteContent,
        color: '#6366F1' // Default indigo color
      });

      if (error) throw error;

      toast.success('Note added successfully! 📝');
      setNoteTitle('');
      setNoteContent('');
      setShowAddNote(false);
      queryClient.invalidateQueries({ queryKey: ['notes', user.id] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const actions = [
    {
      icon: Target,
      label: 'Add Habit',
      onClick: () => setShowAddHabit(true),
      gradient: 'gradient-primary',
    },
    {
      icon: Wallet,
      label: 'Add Transaction',
      onClick: () => setShowAddTransaction(true),
      gradient: 'gradient-success',
    },
    {
      icon: Calendar,
      label: 'Add Event',
      onClick: () => setShowAddEvent(true),
      gradient: 'gradient-cool',
    },
    {
      icon: FileText,
      label: 'Add Note',
      onClick: () => setShowAddNote(true),
      gradient: 'gradient-warm',
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              onClick={action.onClick}
              className="h-auto py-4 flex flex-col items-center gap-2 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', action.gradient)}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                {action.label}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <AddHabitDialog
        open={showAddHabit}
        onOpenChange={setShowAddHabit}
        onSubmit={handleAddHabit}
      />

      <AddTransactionDialog
        accounts={accounts}
        open={showAddTransaction}
        onOpenChange={setShowAddTransaction}
        onTransactionAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
          toast.success('Transaction added!');
        }}
      />

      <AddEventDialog
        open={showAddEvent}
        onOpenChange={setShowAddEvent}
        selectedDate={new Date()}
        onEventAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
        }}
      />

      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Quick Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="noteTitle">Title</Label>
              <Input
                id="noteTitle"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="noteContent">Content</Label>
              <Textarea
                id="noteContent"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write something..."
                rows={4}
              />
            </div>
            <Button type="submit" className="w-full" disabled={savingNote || !noteTitle.trim()}>
              <Save className="w-4 h-4 mr-2" />
              {savingNote ? 'Saving...' : 'Save Note'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
