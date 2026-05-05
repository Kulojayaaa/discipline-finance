import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Target, Plus, Trash2, CheckCircle2, Circle, Calendar, MessageSquarePlus, TrendingUp, ChevronDown, ChevronUp, ListChecks, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

interface Goal {
  id: string; user_id: string; title: string; description: string | null;
  category: string | null; target_date: string | null; is_completed: boolean | null;
  color: string | null; icon: string | null; progress: number | null;
  created_at: string; updated_at: string;
}

interface GoalUpdate {
  id: string; goal_id: string; user_id: string; update_date: string;
  note: string; progress_value: number | null; created_at: string;
}

interface Milestone {
  id: string; goal_id: string; user_id: string; title: string;
  is_completed: boolean; created_at: string;
}

const categories = [
  { value: 'personal', label: 'Personal', color: '#8B5CF6' },
  { value: 'career', label: 'Career', color: '#3B82F6' },
  { value: 'health', label: 'Health', color: '#22C55E' },
  { value: 'finance', label: 'Finance', color: '#F59E0B' },
  { value: 'education', label: 'Education', color: '#EC4899' },
  { value: 'relationships', label: 'Relationships', color: '#EF4444' },
  { value: 'travel', label: 'Travel', color: '#06B6D4' },
  { value: 'other', label: 'Other', color: '#6B7280' },
];

const icons = ['🎯', '⭐', '🏆', '💪', '📚', '💼', '❤️', '✈️', '🎓', '₹', '🏃', '🧘'];

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalUpdates, setGoalUpdates] = useState<Record<string, GoalUpdate[]>>({});
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('personal');
  const [targetDate, setTargetDate] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🎯');
  const [submitting, setSubmitting] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  useEffect(() => {
    if (user) fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('is_completed', { ascending: true })
        .order('target_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const goalsData = (data as Goal[]) || [];
      setGoals(goalsData);

      if (goalsData.length > 0) {
        const goalIds = goalsData.map(g => g.id);

        // Fetch updates
        const { data: updates, error: updatesError } = await supabase
          .from('goal_updates')
          .select('*')
          .eq('user_id', user.id)
          .in('goal_id', goalIds)
          .order('created_at', { ascending: false });
        if (updatesError) throw updatesError;
        const groupedUpdates: Record<string, GoalUpdate[]> = {};
        (updates || []).forEach((u: GoalUpdate) => {
          if (!groupedUpdates[u.goal_id]) groupedUpdates[u.goal_id] = [];
          groupedUpdates[u.goal_id].push(u);
        });
        setGoalUpdates(groupedUpdates);

        const { data: ms, error: msError } = await supabase
          .from('goal_milestones')
          .select('*')
          .eq('user_id', user.id)
          .in('goal_id', goalIds)
          .order('created_at');
        if (!msError && ms) {
          const groupedMs: Record<string, Milestone[]> = {};
          ms.forEach((m: Milestone) => {
            if (!groupedMs[m.goal_id]) groupedMs[m.goal_id] = [];
            groupedMs[m.goal_id].push(m);
          });
          setMilestones(groupedMs);
        } else if (msError) {
          console.warn('goal_milestones:', msError.message);
          setMilestones({});
        }
      }
    } catch {
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setDescription(editingGoal.description || '');
      setCategory(editingGoal.category || 'personal');
      setTargetDate(editingGoal.target_date || '');
      setSelectedIcon(editingGoal.icon || '🎯');
      setDialogOpen(true);
    }
  }, [editingGoal]);

  const handleSubmit = async () => {
    if (!title.trim() || !user) return;
    setSubmitting(true);
    try {
      const categoryData = categories.find(c => c.value === category);
      const goalData = {
        user_id: user.id, title: title.trim(), description: description.trim() || null,
        category, target_date: targetDate || null, icon: selectedIcon,
        color: categoryData?.color || '#8B5CF6',
      };

      if (editingGoal) {
        const { error } = await supabase.from('goals').update(goalData).eq('id', editingGoal.id);
        if (error) throw error;
        toast.success('Goal updated!');
      } else {
        const { error } = await supabase.from('goals').insert(goalData);
        if (error) throw error;
        toast.success('Goal created!');
      }

      setDialogOpen(false);
      setEditingGoal(null);
      resetForm();
      fetchGoals();
    } catch {
      toast.error(editingGoal ? 'Failed to update goal' : 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setCategory('personal'); setTargetDate(''); setSelectedIcon('🎯');
  };

  const toggleComplete = async (goal: Goal) => {
    try {
      const { error } = await supabase.from('goals')
        .update({ is_completed: !goal.is_completed, progress: goal.is_completed ? goal.progress : 100 })
        .eq('id', goal.id);
      if (error) throw error;
      toast.success(goal.is_completed ? 'Goal reopened' : 'Goal completed! 🎉');
      fetchGoals();
    } catch {
      toast.error('Failed to update goal');
    }
  };

  const updateProgress = async (goalId: string, progress: number) => {
    try {
      const { error } = await supabase.from('goals').update({ progress }).eq('id', goalId);
      if (error) throw error;
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, progress } : g));
    } catch {
      toast.error('Failed to update progress');
    }
  };

  const addUpdate = async (goalId: string, note: string, progressValue: number) => {
    if (!user || !note.trim()) return;
    try {
      const { error } = await supabase.from('goal_updates').insert({
        goal_id: goalId, user_id: user.id, note: note.trim(), progress_value: progressValue,
      });
      if (error) throw error;
      await updateProgress(goalId, progressValue);
      toast.success('Update added!');
      fetchGoals();
    } catch {
      toast.error('Failed to add update');
    }
  };

  const deleteGoal = async (id: string) => {
    if (!user) return;
    try {
      const { error: uErr } = await supabase.from('goal_updates').delete().eq('goal_id', id).eq('user_id', user.id);
      if (uErr) throw uErr;
      const { error: mErr } = await supabase.from('goal_milestones').delete().eq('goal_id', id).eq('user_id', user.id);
      if (mErr) throw mErr;
      const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      toast.success('Goal deleted');
      setDeletingGoalId(null);
      fetchGoals();
    } catch {
      toast.error('Failed to delete goal');
    }
  };

  const addMilestone = async (goalId: string, milestoneTitle: string) => {
    if (!user || !milestoneTitle.trim()) return;
    try {
      const { error } = await supabase.from('goal_milestones').insert({
        goal_id: goalId, user_id: user.id, title: milestoneTitle.trim(),
      });
      if (error) throw error;
      fetchGoals();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.includes('goal_milestones') ? 'Run the goal_milestones migration in Supabase first' : 'Failed to add milestone');
    }
  };

  const toggleMilestone = async (milestoneId: string, isCompleted: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('goal_milestones')
        .update({ is_completed: !isCompleted })
        .eq('id', milestoneId)
        .eq('user_id', user.id);
      if (error) throw error;
      fetchGoals();
    } catch {
      toast.error('Failed to update milestone');
    }
  };

  const activeGoals = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);
  const deletingGoal = goals.find(g => g.id === deletingGoalId);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Goals</h1>
            <p className="text-muted-foreground">Track your personal and professional goals</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Add Goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Learn a new language" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your goal in detail..." rows={3} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Date</Label>
                  <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
                </div>
                <div>
                  <Label>Icon</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {icons.map(icon => (
                      <button key={icon} type="button" onClick={() => setSelectedIcon(icon)}
                        className={cn('w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all', selectedIcon === icon ? 'bg-primary text-primary-foreground ring-2 ring-primary' : 'bg-muted hover:bg-muted/80')}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => { setDialogOpen(false); setEditingGoal(null); resetForm(); }}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSubmit} disabled={submitting || !title.trim()}>
                    {submitting ? (editingGoal ? 'Updating...' : 'Creating...') : (editingGoal ? 'Update Goal' : 'Create Goal')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Goals', value: goals.length, icon: Target, color: 'primary' },
            { label: 'In Progress', value: activeGoals.length, icon: Circle, color: 'orange' },
            { label: 'Completed', value: completedGoals.length, icon: CheckCircle2, color: 'green' },
            { label: 'Avg Progress', value: `${activeGoals.length > 0 ? Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length) : 0}%`, icon: TrendingUp, color: 'blue' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 text-${color === 'primary' ? 'primary' : color + '-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Circle className="w-5 h-5 text-orange-500" />
              Active Goals ({activeGoals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4"><SkeletonCard count={2} /></div>
            ) : activeGoals.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No active goals. Create your first goal!</p>
            ) : (
              <div className="space-y-4">
                {activeGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    updates={goalUpdates[goal.id] || []}
                    milestones={milestones[goal.id] || []}
                    onToggle={toggleComplete}
                    onDelete={(id) => setDeletingGoalId(id)}
                    onEdit={(goal) => setEditingGoal(goal)}
                    onUpdateProgress={updateProgress}
                    onAddUpdate={addUpdate}
                    onAddMilestone={addMilestone}
                    onToggleMilestone={toggleMilestone}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Completed Goals ({completedGoals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {completedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    updates={goalUpdates[goal.id] || []}
                    milestones={milestones[goal.id] || []}
                    onToggle={toggleComplete}
                    onDelete={(id) => setDeletingGoalId(id)}
                    onEdit={(goal) => setEditingGoal(goal)}
                    onUpdateProgress={updateProgress}
                    onAddUpdate={addUpdate}
                    onAddMilestone={addMilestone}
                    onToggleMilestone={toggleMilestone}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Goal Confirmation */}
      <AlertDialog open={!!deletingGoalId} onOpenChange={o => { if (!o) setDeletingGoalId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingGoal?.title}"? All updates and milestones will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingGoalId && deleteGoal(deletingGoalId)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function GoalCard({
  goal, updates, milestones, onToggle, onDelete, onEdit, onUpdateProgress, onAddUpdate, onAddMilestone, onToggleMilestone,
}: {
  goal: Goal; updates: GoalUpdate[]; milestones: Milestone[];
  onToggle: (goal: Goal) => void; onDelete: (id: string) => void; onEdit: (goal: Goal) => void;
  onUpdateProgress: (id: string, progress: number) => void;
  onAddUpdate: (goalId: string, note: string, progressValue: number) => void;
  onAddMilestone: (goalId: string, title: string) => void;
  onToggleMilestone: (id: string, isCompleted: boolean) => void;
}) {
  const categoryData = categories.find(c => c.value === goal.category);
  const [expanded, setExpanded] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateNote, setUpdateNote] = useState('');
  const [updateProgress, setUpdateProgressVal] = useState(goal.progress || 0);
  const [newMilestone, setNewMilestone] = useState('');
  const [showMilestones, setShowMilestones] = useState(false);
  const progress = goal.progress || 0;

  const handleAddUpdate = () => {
    onAddUpdate(goal.id, updateNote, updateProgress);
    setUpdateNote('');
    setUpdateDialogOpen(false);
  };

  const getProgressColor = () => {
    if (progress >= 75) return 'bg-green-500';
    if (progress >= 50) return 'bg-orange-500';
    if (progress >= 25) return 'bg-blue-500';
    return 'bg-muted-foreground';
  };

  const completedMilestones = milestones.filter(m => m.is_completed).length;

  return (
    <div className={cn('p-4 rounded-xl border-2 bg-card group transition-all', goal.is_completed ? 'border-green-500/30 opacity-70' : 'border-border hover:shadow-md')}>
      <div className="flex items-start gap-3">
        <button onClick={() => onToggle(goal)} className="mt-1 flex-shrink-0">
          {goal.is_completed
            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
            : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{goal.icon}</span>
              <h3 className={cn('font-semibold text-foreground', goal.is_completed && 'line-through')}>{goal.title}</h3>
            </div>
            <div className="flex items-center gap-1">
              {!goal.is_completed && (
                <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Add update">
                      <MessageSquarePlus className="w-4 h-4 text-primary" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Update Progress — {goal.title}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Progress: {updateProgress}%</Label>
                        <Slider value={[updateProgress]} onValueChange={([v]) => setUpdateProgressVal(v)} max={100} step={5} className="mt-2" />
                      </div>
                      <div>
                        <Label>What did you do today?</Label>
                        <Textarea value={updateNote} onChange={e => setUpdateNote(e.target.value)} placeholder="Describe your progress..." rows={3} />
                      </div>
                      <Button className="w-full" onClick={handleAddUpdate} disabled={!updateNote.trim()}>Save Update</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onEdit(goal)}>
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onDelete(goal.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>

          {goal.description && <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>}

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">{progress}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', getProgressColor())} style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {categoryData && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${categoryData.color}20`, color: categoryData.color }}>
                {categoryData.label}
              </span>
            )}
            {goal.target_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(goal.target_date), 'MMM d, yyyy')}
              </span>
            )}
            {/* Milestones toggle */}
            <button onClick={() => setShowMilestones(!showMilestones)}
              className="text-xs text-primary flex items-center gap-1 hover:underline ml-auto">
              <ListChecks className="w-3 h-3" />
              Milestones ({completedMilestones}/{milestones.length})
              {showMilestones ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {updates.length > 0 && (
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary flex items-center gap-1 hover:underline">
                {updates.length} update{updates.length > 1 ? 's' : ''}
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Milestones section */}
          {showMilestones && (
            <div className="mt-3 border-t border-border pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Milestones</p>
              {milestones.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={m.is_completed}
                    onCheckedChange={() => onToggleMilestone(m.id, m.is_completed)}
                  />
                  <span className={cn('text-sm', m.is_completed && 'line-through text-muted-foreground')}>{m.title}</span>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Input
                  value={newMilestone}
                  onChange={e => setNewMilestone(e.target.value)}
                  placeholder="New milestone..."
                  className="h-8 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && newMilestone.trim()) { onAddMilestone(goal.id, newMilestone); setNewMilestone(''); } }}
                />
                <Button size="sm" variant="outline" onClick={() => { if (newMilestone.trim()) { onAddMilestone(goal.id, newMilestone); setNewMilestone(''); } }}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Updates timeline */}
          {expanded && updates.length > 0 && (
            <div className="mt-3 border-t border-border pt-3 space-y-2">
              {updates.slice(0, 10).map(update => (
                <div key={update.id} className="flex gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{format(new Date(update.created_at), 'MMM d, yyyy')}</span>
                      {update.progress_value != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{update.progress_value}%</span>
                      )}
                    </div>
                    <p className="text-foreground mt-0.5">{update.note}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
