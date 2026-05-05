import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Target,
  Wallet,
  Calendar,
  FileText,
  Bell,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Package,
  Receipt,
  Shield,
  Flag,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tables } from '@/integrations/supabase/types';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Flag, label: 'Goals', path: '/goals' },
  { icon: Target, label: 'Habits', path: '/habits' },
  { icon: Wallet, label: 'Expenses', path: '/expenses' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: Receipt, label: 'Bills', path: '/bills' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: FileText, label: 'Notes', path: '/notes' },
  { icon: Key, label: 'Vault', path: '/vault' },
  { icon: Bell, label: 'Reminders', path: '/reminders' },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, user, isAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .maybeSingle();
    if (data) setProfile(data);
  };

  const handleSignOut = async () => {
    await signOut();
  };
  
  const getInitials = (name: string | null) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside
      className={cn(
        'h-screen bg-card border-r border-border flex flex-col transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="text-xl font-bold text-foreground">LifeSync</span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'gradient-primary text-white shadow-glow'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 flex-shrink-0',
                  isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              {!collapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            to="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group mt-4 border border-primary/20',
              location.pathname === '/admin'
                ? 'gradient-primary text-white shadow-glow'
                : 'text-primary hover:bg-primary/10'
            )}
          >
            <Shield className={cn('w-5 h-5 flex-shrink-0', location.pathname === '/admin' ? 'text-white' : 'text-primary')} />
            {!collapsed && <span className="font-medium">Admin Panel</span>}
          </Link>
        )}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border space-y-2">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
            location.pathname === '/settings'
              ? 'gradient-primary text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Settings</span>}
        </Link>
        
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Sign Out</span>}
        </button>

        {!collapsed && user && (
          <div className="mt-4 p-3 bg-muted/50 rounded-xl flex items-center gap-3">
            <Avatar className="w-10 h-10 border border-primary/10">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <AvatarFallback className="gradient-primary text-white text-xs">{getInitials(profile?.full_name || null)}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name || user.email}
              </p>
              <p className="text-xs text-muted-foreground">Free Plan</p>
            </div>
          </div>
        )}
        {collapsed && user && (
          <div className="mt-4 flex justify-center">
            <Avatar className="w-8 h-8 border border-primary/10">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <AvatarFallback className="gradient-primary text-white text-[10px]">{getInitials(profile?.full_name || null)}</AvatarFallback>
              )}
            </Avatar>
          </div>
        )}
      </div>
    </aside>
  );
}
