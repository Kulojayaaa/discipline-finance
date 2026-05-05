import { useState } from 'react';
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
import { differenceInDays, eachDayOfInterval, isWeekend, parseISO } from 'date-fns';

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

interface AddHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (habit: {
    name: string;
    description: string;
    category: string;
    frequency: string;
    targetCount: number;
    icon: string;
    color: string;
    startDate: string;
    endDate: string;
    skipWeekends: boolean;
    skipHolidays: boolean;
    customSkipDays: string[];
    goal: string;
  }) => void;
}

export function AddHabitDialog({ open, onOpenChange, onSubmit }: AddHabitDialogProps) {
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

  const calculateTargetCount = () => {
    if (!startDate || !endDate) return 1;
    
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    if (end < start) return 1;
    
    const allDays = eachDayOfInterval({ start, end });
    const customDates = customSkipDays.split(',').map(d => d.trim()).filter(Boolean);
    
    const count = allDays.filter(day => {
      if (skipWeekends && isWeekend(day)) return false;
      const dayStr = day.toISOString().split('T')[0];
      if (customDates.includes(dayStr)) return false;
      return true;
    }).length;
    
    return Math.max(count, 1);
  };

  const targetCount = calculateTargetCount();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      category,
      frequency,
      targetCount,
      icon: selectedIcon,
      color: selectedColor,
      startDate,
      endDate,
      skipWeekends,
      skipHolidays,
      customSkipDays: customSkipDays.split(',').map(d => d.trim()).filter(Boolean),
      goal,
    });
    // Reset form
    setName('');
    setDescription('');
    setCategory('other');
    setFrequency('daily');
    setSelectedIcon('🎯');
    setSelectedColor('#8B5CF6');
    setStartDate('');
    setEndDate('');
    setSkipWeekends(false);
    setSkipHolidays(false);
    setCustomSkipDays('');
    setGoal('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Create New Habit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="habit-name">Habit Name</Label>
            <Input
              id="habit-name"
              placeholder="e.g., Drink 8 glasses of water"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal">Goal (What do you want to achieve?)</Label>
            <Textarea
              id="goal"
              placeholder="e.g., Complete 30 days of exercise to improve fitness"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
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
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
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
                  id="skip-weekends"
                  checked={skipWeekends}
                  onCheckedChange={(checked) => setSkipWeekends(checked === true)}
                />
                <Label htmlFor="skip-weekends" className="text-sm font-normal cursor-pointer">
                  Skip Weekends
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skip-holidays"
                  checked={skipHolidays}
                  onCheckedChange={(checked) => setSkipHolidays(checked === true)}
                />
                <Label htmlFor="skip-holidays" className="text-sm font-normal cursor-pointer">
                  Skip Holidays
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-skip" className="text-sm">Custom Skip Dates (comma-separated)</Label>
              <Input
                id="custom-skip"
                placeholder="e.g., 2025-01-15, 2025-01-20"
                value={customSkipDays}
                onChange={(e) => setCustomSkipDays(e.target.value)}
              />
            </div>
          </div>

          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-sm text-foreground">
              <span className="font-medium">Calculated Target:</span> {targetCount} days
              {startDate && endDate && (
                <span className="text-muted-foreground ml-2">
                  ({startDate} to {endDate})
                </span>
              )}
            </p>
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
              Create Habit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
