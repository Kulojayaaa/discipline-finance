import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EVENT_TYPES = [
  { value: 'general', label: 'General', color: '#8B5CF6' },
  { value: 'holiday', label: 'Holiday', color: '#F59E0B' },
  { value: 'birthday', label: 'Birthday', color: '#EC4899' },
  { value: 'meeting', label: 'Meeting', color: '#3B82F6' },
  { value: 'reminder', label: 'Reminder', color: '#10B981' },
];

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onEventAdded: () => void;
}

export function AddEventDialog({ open, onOpenChange, selectedDate, onEventAdded }: AddEventDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'general',
    all_day: true,
    start_time: '',
    end_time: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title) return;

    setLoading(true);
    try {
      const eventType = EVENT_TYPES.find(t => t.value === formData.event_type);
      
      const { error } = await supabase.from('calendar_events').insert({
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        event_date: format(selectedDate, 'yyyy-MM-dd'),
        event_type: formData.event_type,
        all_day: formData.all_day,
        start_time: formData.all_day ? null : formData.start_time,
        end_time: formData.all_day ? null : formData.end_time,
        color: eventType?.color || '#8B5CF6',
      });

      if (error) throw error;

      toast.success('Event added!');
      setFormData({ title: '', description: '', event_type: 'general', all_day: true, start_time: '', end_time: '' });
      onOpenChange(false);
      onEventAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Event - {format(selectedDate, 'dd MMMM yyyy')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Event title"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select value={formData.event_type} onValueChange={(v) => setFormData({ ...formData, event_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>All Day Event</Label>
            <Switch
              checked={formData.all_day}
              onCheckedChange={(v) => setFormData({ ...formData, all_day: v })}
            />
          </div>
          {!formData.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add details..."
              rows={3}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : 'Add Event'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
