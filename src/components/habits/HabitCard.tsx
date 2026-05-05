import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Flame, MoreVertical, Target, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';

interface HabitCardProps {
  id: string;
  name: string;
  icon: string;
  category: string;
  streak: number;
  isCompleted: boolean;
  targetCount: number;
  currentCount: number;
  color: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function HabitCard({
  name,
  icon,
  category,
  streak,
  isCompleted,
  targetCount,
  currentCount,
  color,
  goal,
  startDate,
  endDate,
  onToggle,
  onEdit,
  onDelete,
}: HabitCardProps) {
  const progress = (currentCount / targetCount) * 100;

  return (
    <div
      className={cn(
        'relative p-4 rounded-2xl border-2 transition-all duration-300 group',
        isCompleted
          ? 'border-success bg-success/5'
          : 'border-border bg-card hover:border-primary/50 hover:shadow-lg'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${color}20` }}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{category.replace('_', ' ')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning/10 text-warning text-sm font-medium">
              <Flame className="w-4 h-4" />
              {streak}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Goal display */}
      {goal && (
        <div className="mb-3 p-2 bg-primary/5 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-foreground font-medium">Goal:</span>
            <span className="text-muted-foreground">{goal}</span>
          </div>
        </div>
      )}

      {/* Period display */}
      {startDate && endDate && (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>
            {format(parseISO(startDate), 'MMM d')} - {format(parseISO(endDate), 'MMM d, yyyy')}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-foreground">{currentCount}/{targetCount}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: isCompleted ? 'hsl(var(--success))' : color,
            }}
          />
        </div>
      </div>

      {/* Toggle button */}
      <Button
        variant={isCompleted ? 'default' : 'outline'}
        className={cn(
          'w-full',
          isCompleted && 'bg-success hover:bg-success/90 text-white'
        )}
        onClick={onToggle}
      >
        {isCompleted ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Completed!
          </>
        ) : (
          <>
            <Circle className="w-4 h-4 mr-2" />
            Mark Complete
          </>
        )}
      </Button>
    </div>
  );
}
