import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient?: 'primary' | 'secondary' | 'success' | 'warm' | 'cool' | 'sunset';
  className?: string;
  isLink?: boolean;
  linkTo?: string;
}

const gradientClasses = {
  primary: 'gradient-primary',
  secondary: 'gradient-secondary',
  success: 'gradient-success',
  warm: 'gradient-warm',
  cool: 'gradient-cool',
  sunset: 'gradient-sunset',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  gradient = 'primary',
  className,
  isLink,
  linkTo,
}: StatCardProps) {
  const content = (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-6 text-white transition-transform hover:scale-[1.02]',
        gradientClasses[gradient],
        isLink && 'cursor-pointer',
        className
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" />
          </div>
          {trend && (
            <div
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium',
                trend.isPositive ? 'bg-white/20 text-white' : 'bg-white/20 text-white'
              )}
            >
              {trend.isPositive ? '+' : ''}{trend.value}%
            </div>
          )}
        </div>
        
        <h3 className="text-white/80 text-sm font-medium mb-1">{title}</h3>
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        {subtitle && (
          <p className="text-white/70 text-sm">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (isLink && linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return content;
}
