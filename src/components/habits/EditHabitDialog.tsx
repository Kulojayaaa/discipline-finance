import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tables } from '@/integrations/supabase/types';

const categories = [
  { value: 'health', label: 'Health', icon: '💪' },
  { value: 'self_care', label: 'Self Care', icon: '🧘' },
  { value: 'self_love', label: 'Self Love', icon: '❤️' },
  { value: 'attitude', label: 'Attitude', icon: '😊' },
  { value: 'learning', label: 'Learning', icon: '📚' },
  { value: 'fitness', label: 'Fitness', icon: '🏃' },
  { value: 'mindfulness', label: 'Mindfulness', icon: '🧠' },
  { value: 'productivity', label: 'Productivity', icon: '⚡' },
  { value: 'social', label: 'Social', icon: '👥' },
  { value: 'other', label: 'Other', icon: '🎯' },
];

const icons = ['🎯', '💪', '🧘', '❤️', '😊', '📚', '🏃', '🧠', '⚡', '👥', '💧', '🍎', '😴', '🌅', '🎨', '🎵', '₹', '✨'];
const colors = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6', '#F97316'];

interface EditHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Tables<'habits'> | null;
  onSubmit: (habitId: string, updates: Partial<Tables<'habits'>>) => void;
}

export function EditHabitDialog({ open, onOpenChange, habit, onSubmit }: EditHabitDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [frequency, setFrequency] = useState('daily');
  const [selectedIcon, setSelectedIcon] = useState('🎯');
  const [selectedColor, setSelectedColor] = useState('#8B5CF6');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [skipHolidays, setSkipHolidays] = useState(false);
  const [customSkipDays, setCustomSkipDays] = useState('');
  const [goal, setGoal] = useState('');

  useEffect(() => {
    if (habit) {
      setName(habit.name || '');
      setDescription(habit.description || '');
      setCategory(habit.category || 'other');
      setFrequency(habit.frequency || 'daily');
      setSelectedIcon(habit.icon || '🎯');
      setSelectedColor(habit.color || '#8B5CF6');
      setStartDate(habit.start_date || '');
      setEndDate(habit.end_date || '');
      setSkipWeekends(habit.skip_weekends || false);
      setSkipHolidays(habit.skip_holidays || false);
      setCustomSkipDays((habit.custom_skip_days || []).join(', '));
      setGoal(habit.goal || '');
    }
  }, [habit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habit) return;
    onSubmit(habit.id, {
      name,
      description,
      category: category as Tables<'habits'>['category'],
      frequency,
      icon: selectedIcon,
      color: selectedColor,
      start_date: startDate || null,
      end_date: endDate || null,
      skip_weekends: skipWeekends,
      skip_holidays: skipHolidays,
      custom_skip_days: customSkipDays.split(',').map(d => d.trim()).filter(Boolean),
      goal: goal || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Habit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-habit-name">Habit Name</Label>
            <Input
              id="edit-habit-name"
              placeholder="e.g., Drink 8 glasses of water"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Goal</Label>
            <Textarea
              placeholder="What do you want to achieve?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Why is this habit important to you?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        {cat.icon} {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <Label className="text-sm font-medium">Skip Days Options</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-skip-weekends"
                  checked={skipWeekends}
                  onCheckedChange={(checked) => setSkipWeekends(checked === true)}
                />
                <Label htmlFor="edit-skip-weekends" className="text-sm font-normal cursor-pointer">
                  Skip Weekends
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-skip-holidays"
                  checked={skipHolidays}
                  onCheckedChange={(checked) => setSkipHolidays(checked === true)}
                />
                <Label htmlFor="edit-skip-holidays" className="text-sm font-normal cursor-pointer">
                  Skip Holidays
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Custom Skip Dates (comma-separated)</Label>
              <Input
                placeholder="e.g., 2025-01-15, 2025-01-20"
                value={customSkipDays}
                onChange={(e) => setCustomSkipDays(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {icons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    selectedIcon === icon
                      ? 'bg-primary text-primary-foreground scale-110'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary text-white">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
