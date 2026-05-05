import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { HabitCard } from '@/components/habits/HabitCard';
import { AddHabitDialog } from '@/components/habits/AddHabitDialog';
import { EditHabitDialog } from '@/components/habits/EditHabitDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { Plus, Flame, Target, Trophy, BarChart2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getTodayDate, toLocalDateString } from '@/lib/date';
import { exportToCSV } from '@/lib/export';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { subDays, format, isWeekend } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

export default function Habits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [habits, setHabits] = useState<Tables<'habits'>[]>([]);
  const [habitLogs, setHabitLogs] = useState<Tables<'habit_logs'>[]>([]);
  const [allLogs, setAllLogs] = useState<Tables<'habit_logs'>[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Tables<'habits'> | null>(null);
  const [deletingHabitId, setDeletingHabitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      Promise.all([fetchHabits(), fetchTodayLogs(), fetchAllLogs()]).finally(() => setLoading(false));
    }
  }, [user]);

  const fetchHabits = async () => {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setHabits(data || []);
  };

  const fetchTodayLogs = async () => {
    const today = getTodayDate();
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user?.id)
      .eq('completed_at', today);
    if (error) { console.error('Error fetching today logs:', error); return; }
    setHabitLogs(data || []);
  };

  const fetchAllLogs = async () => {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user?.id)
      .order('completed_at', { ascending: false });
    if (error) { console.error('Error fetching all logs:', error); return; }
    setAllLogs(data || []);
  };

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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Habit created! 🎉', description: 'Start tracking your new habit.' });
      fetchHabits();
      queryClient.invalidateQueries({ queryKey: ['habits', user?.id] });
    }
  };

  const handleEditHabit = async (habitId: string, updates: Partial<Tables<'habits'>>) => {
    const { error } = await supabase.from('habits').update(updates).eq('id', habitId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Habit updated!' });
      fetchHabits();
      queryClient.invalidateQueries({ queryKey: ['habits', user?.id] });
    }
  };

  const toggleHabit = async (habitId: string, isCompleted: boolean) => {
    const today = getTodayDate();
    if (!user) return;
    if (isCompleted) {
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', user.id)
        .eq('completed_at', today);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase.from('habit_logs').insert({
        habit_id: habitId,
        user_id: user.id,
        completed_at: today,
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }
    fetchTodayLogs();
    fetchAllLogs();
  };

  const deleteHabit = async (habitId: string) => {
    if (!user) return;
    const { error: logErr } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('user_id', user.id);
    setDeletingHabitId(null);
    if (logErr) {
      toast({ title: 'Error', description: logErr.message, variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('habits').delete().eq('id', habitId).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Habit deleted' });
    fetchHabits();
    fetchTodayLogs();
    fetchAllLogs();
    queryClient.invalidateQueries({ queryKey: ['habits', user?.id] });
  };

  // Calculate streak — skips over weekends (if skip_weekends) and custom_skip_days
  const calculateStreak = (habit: Tables<'habits'>): number => {
    const logs = allLogs
      .filter(l => l.habit_id === habit.id)
      .map(l => l.completed_at)
      .sort((a: string, b: string) => b.localeCompare(a));

    if (logs.length === 0) return 0;
    const uniqueDates = [...new Set(logs)] as string[];
    const today = getTodayDate();
    const yesterday = toLocalDateString(subDays(new Date(), 1));

    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

    const customSkipDays = new Set(habit.custom_skip_days || []);

    const isSkippedDay = (dateStr: string): boolean => {
      if (customSkipDays.has(dateStr)) return true;
      if (habit.skip_weekends) {
        const d = new Date(dateStr + 'T00:00:00');
        if (isWeekend(d)) return true;
      }
      return false;
    };

    let streak = 0;
    let cursor = new Date(uniqueDates[0] + 'T00:00:00');
    let logIndex = 0;

    // Walk back from most recent date
    while (logIndex < uniqueDates.length) {
      const curStr = toLocalDateString(cursor);
      if (isSkippedDay(curStr)) {
        cursor = subDays(cursor, 1);
        continue;
      }
      if (uniqueDates[logIndex] === curStr) {
        streak++;
        logIndex++;
        cursor = subDays(cursor, 1);
      } else {
        break;
      }
    }
    return streak;
  };

  // Daily score
  const completedToday = habitLogs.length;
  const totalHabits = habits.length;
  const dailyScore = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  // Best streak
  const bestStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.max(...habits.map(h => calculateStreak(h)), 0);
  }, [habits, allLogs]);

  // Heatmap: last 84 days (12 weeks)
  const heatmapDays = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = toLocalDateString(d);
      const count = allLogs.filter(l => l.completed_at === dateStr).length;
      days.push({ date: dateStr, count });
    }
    return days;
  }, [allLogs]);

  const maxHeatmapCount = useMemo(() => Math.max(...heatmapDays.map(d => d.count), 1), [heatmapDays]);

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    const ratio = count / maxHeatmapCount;
    if (ratio < 0.33) return 'bg-primary/30';
    if (ratio < 0.66) return 'bg-primary/60';
    return 'bg-primary';
  };

  const handleExport = () => {
    if (habits.length === 0) return;
    const data = habits.map(h => ({
      Name: h.name,
      Category: h.category,
      Frequency: h.frequency,
      'Target Count': h.target_count,
      Goal: h.goal || '',
      'Current Streak': calculateStreak(h),
      'Start Date': h.start_date || '',
      'End Date': h.end_date || '',
    }));
    exportToCSV(data, 'habits_export');
    toast({ title: 'Exported!', description: 'Habits exported as CSV.' });
  };

  const deletingHabit = habits.find(h => h.id === deletingHabitId);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Habits</h1>
            <p className="text-muted-foreground">Track your daily habits and build streaks</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={habits.length === 0}>
              Export CSV
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gradient-primary text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Habit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Daily Score</p>
                  <p className="text-2xl font-bold text-foreground">{dailyScore}%</p>
                </div>
              </div>
              <Progress value={dailyScore} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{completedToday} / {totalHabits} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Best Streak</p>
                <p className="text-2xl font-bold text-foreground">🔥 {bestStreak} days</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Habits</p>
                <p className="text-2xl font-bold text-foreground">{totalHabits}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Heatmap */}
        {allLogs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Habit Activity (Last 12 Weeks)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-84 gap-1 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(84, minmax(0, 1fr))' }}>
                {heatmapDays.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} habit${day.count !== 1 ? 's' : ''}`}
                    className={cn('w-3 h-3 rounded-sm cursor-pointer transition-opacity hover:opacity-80', getHeatmapColor(day.count))}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <span>Less</span>
                <div className="bg-muted w-3 h-3 rounded-sm" />
                <div className="bg-primary/30 w-3 h-3 rounded-sm" />
                <div className="bg-primary/60 w-3 h-3 rounded-sm" />
                <div className="bg-primary w-3 h-3 rounded-sm" />
                <span>More</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Habits Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard count={3} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {habits.map((habit) => {
              const todayLog = habitLogs.find((log) => log.habit_id === habit.id);
              const streak = calculateStreak(habit);
              return (
                <HabitCard
                  key={habit.id}
                  id={habit.id}
                  name={habit.name}
                  icon={habit.icon}
                  category={habit.category}
                  streak={streak}
                  isCompleted={!!todayLog}
                  targetCount={habit.target_count || 1}
                  currentCount={todayLog ? 1 : 0}
                  color={habit.color}
                  goal={habit.goal}
                  startDate={habit.start_date}
                  endDate={habit.end_date}
                  onToggle={() => toggleHabit(habit.id, !!todayLog)}
                  onEdit={() => setEditingHabit(habit)}
                  onDelete={() => setDeletingHabitId(habit.id)}
                />
              );
            })}
          </div>
        )}

        {habits.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No habits created yet. Start building better routines!</p>
            <Button onClick={() => setShowAddDialog(true)} className="gradient-primary text-white">
              <Plus className="w-4 h-4 mr-2" /> Create Habit
            </Button>
          </div>
        )}

        <AddHabitDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSubmit={handleAddHabit} />
        <EditHabitDialog
          open={!!editingHabit}
          onOpenChange={(open) => { if (!open) setEditingHabit(null); }}
          habit={editingHabit}
          onSubmit={handleEditHabit}
        />

        <AlertDialog open={!!deletingHabitId} onOpenChange={(open) => { if (!open) setDeletingHabitId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Habit</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingHabit?.name}"? This will also remove all your logs. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingHabitId && deleteHabit(deletingHabitId)} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
