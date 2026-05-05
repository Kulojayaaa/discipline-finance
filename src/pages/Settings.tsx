import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency, CurrencyCode } from '@/hooks/CurrencyContext';
import { useTheme, Theme } from '@/hooks/ThemeContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Save, Download, Trash2, Sun, Moon, Monitor, AlertTriangle, Camera, Loader2, X, Key, Eye, EyeOff } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { exportToCSV } from '@/lib/export';

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'INR', label: 'Indian Rupee (₹)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'AED', label: 'UAE Dirham (د.إ)' },
  { value: 'SGD', label: 'Singapore Dollar (S$)' },
];

const VAULT_KEY_STORAGE = 'fintrack:vault-master-key';

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { currency, setCurrency, currencyLabels } = useCurrency();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [formData, setFormData] = useState({ full_name: '' });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [vaultKey, setVaultKey] = useState('');
  const [showVaultKey, setShowVaultKey] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  useEffect(() => {
    setVaultKey(localStorage.getItem(VAULT_KEY_STORAGE) || '');
  }, []);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user?.id).maybeSingle();
      if (error) throw error;
      if (data) {
        setProfile(data);
        setFormData({ full_name: data.full_name || '' });
      }
    } catch (error: any) {
      console.error('Failed to load profile', error);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: formData.full_name }).eq('user_id', user.id);
      if (error) throw error;
      toast.success('Profile updated!');
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }
      if (!user) return;

      setUploading(true);
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast.success('Avatar updated!');
      fetchProfile();
    } catch (error: any) {
      console.error('Upload error:', error);
      if (error.message?.includes('bucket') || error.message?.toLowerCase().includes('not found')) {
        toast.error('Avatar storage is not ready.');
      } else {
        toast.error(error.message || 'Failed to upload avatar');
      }
    } finally {
      setUploading(false);
    }
  };

  const deleteAvatar = async () => {
    try {
      if (!user || !profile?.avatar_url) return;
      setUploading(true);

      // Extract filename from URL (this is a bit hacky but works for Supabase public URLs)
      // or we can just set avatar_url to null
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast.success('Avatar removed');
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const saveVaultKey = () => {
    if (!vaultKey.trim()) {
      localStorage.removeItem(VAULT_KEY_STORAGE);
      toast.success('Vault key cleared');
      return;
    }

    localStorage.setItem(VAULT_KEY_STORAGE, vaultKey.trim());
    toast.success('Vault key saved on this device');
  };

  const getInitials = (name: string | null) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Export helpers
  const exportTransactions = async () => {
    if (!user) {
      toast.error('Sign in to export data');
      return;
    }
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false });
    if (error) {
      toast.error(error.message || 'Failed to load transactions');
      return;
    }
    if (!data || data.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    exportToCSV(
      data.map((t) => ({
        Date: t.transaction_date,
        Type: t.type,
        Category: t.category,
        Amount: t.amount,
        Description: t.description || '',
        'Payment Mode': t.payment_mode || '',
      })),
      'transactions',
    );
    toast.success('Transactions exported!');
  };

  const exportHabits = async () => {
    if (!user) {
      toast.error('Sign in to export data');
      return;
    }
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id),
      supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false }),
    ]);
    if (habitsRes.error) {
      toast.error(habitsRes.error.message || 'Failed to load habits');
      return;
    }
    if (logsRes.error) {
      toast.error(logsRes.error.message || 'Failed to load habit logs');
      return;
    }
    if (habitsRes.data && habitsRes.data.length > 0) exportToCSV(habitsRes.data, 'habits');
    if (logsRes.data && logsRes.data.length > 0) exportToCSV(logsRes.data, 'habit_logs');
    if (
      (!habitsRes.data || habitsRes.data.length === 0) &&
      (!logsRes.data || logsRes.data.length === 0)
    ) {
      toast.error('No habits to export');
      return;
    }
    toast.success('Habits & logs exported!');
  };

  const exportGoals = async () => {
    if (!user) {
      toast.error('Sign in to export data');
      return;
    }
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', user.id);
    if (error) {
      toast.error(error.message || 'Failed to load goals');
      return;
    }
    if (!data || data.length === 0) {
      toast.error('No goals to export');
      return;
    }
    exportToCSV(data, 'goals');
    toast.success('Goals exported!');
  };

  const exportNotes = async () => {
    if (!user) {
      toast.error('Sign in to export data');
      return;
    }
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', user.id);
    if (error) {
      toast.error(error.message || 'Failed to load notes');
      return;
    }
    if (!data || data.length === 0) {
      toast.error('No notes to export');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Notes exported as JSON!');
  };

  const exportReminders = async () => {
    if (!user) {
      toast.error('Sign in to export data');
      return;
    }
    const { data, error } = await supabase.from('reminders').select('*').eq('user_id', user.id);
    if (error) {
      toast.error(error.message || 'Failed to load reminders');
      return;
    }
    if (!data || data.length === 0) {
      toast.error('No reminders to export');
      return;
    }
    exportToCSV(data, 'reminders');
    toast.success('Reminders exported!');
  };

  const deleteAllData = async () => {
    if (!user) return;
    setDeletingData(true);
    const uid = user.id;
    const failures: string[] = [];

    const deleteOwn = async (table: string) => {
      const { error } = await supabase.from(table as 'transactions').delete().eq('user_id', uid);
      if (error) failures.push(`${table}: ${error.message}`);
    };

    try {
      await Promise.all([
        deleteOwn('habit_logs'),
        deleteOwn('goal_updates'),
        deleteOwn('goal_milestones'),
        deleteOwn('bill_payment_history'),
        deleteOwn('product_purchase_history'),
        deleteOwn('emi_payments'),
        deleteOwn('passwords'),
      ]);
      await Promise.all([
        deleteOwn('transactions'),
        deleteOwn('budgets'),
        deleteOwn('savings_goals'),
        deleteOwn('emis'),
        deleteOwn('bills'),
        deleteOwn('accounts'),
        deleteOwn('product_usage'),
        deleteOwn('calendar_events'),
        deleteOwn('reminders'),
        deleteOwn('notes'),
        deleteOwn('goals'),
        deleteOwn('habits'),
        deleteOwn('monthly_plan'),
        deleteOwn('debt_tracker'),
        deleteOwn('categories'),
      ]);

      if (failures.length > 0) {
        toast.error(`Some tables failed to delete (${failures.length}). Check console.`);
        console.error('deleteAllData failures:', failures);
      } else {
        localStorage.removeItem(VAULT_KEY_STORAGE);
        toast.success('All app data deleted');
        setShowDeleteDialog(false);
        await signOut();
        navigate('/auth');
      }
    } catch (error: any) {
      toast.error('Failed to delete data: ' + (error?.message || String(error)));
    } finally {
      setDeletingData(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateProfile} className="space-y-6">
              <div className="flex items-center gap-6 mb-8">
                <div className="relative group">
                  <Avatar className="w-24 h-24 border-2 border-primary/20">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <AvatarFallback className="gradient-primary text-white text-2xl">{getInitials(formData.full_name)}</AvatarFallback>
                    )}
                  </Avatar>
                  <label 
                    htmlFor="avatar-upload" 
                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                  >
                    {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                    className="hidden"
                  />
                  {profile?.avatar_url && (
                    <button
                      type="button"
                      onClick={deleteAvatar}
                      className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform"
                      title="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{formData.full_name || 'Your Name'}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-primary mt-1">Click image to upload new photo</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="Enter your full name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Currency */}
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Currency symbol used throughout the app</p>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                {([
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ] as { value: Theme; label: string; icon: any }[]).map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={theme === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme(value)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Preference is saved and applied instantly</p>
            </div>

            <div className="space-y-2">
              <Label>Vault Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showVaultKey ? 'text' : 'password'}
                    value={vaultKey}
                    onChange={(e) => setVaultKey(e.target.value)}
                    placeholder="Set vault key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setShowVaultKey((value) => !value)}
                  >
                    {showVaultKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <Button type="button" variant="outline" onClick={saveVaultKey}>
                  <Key className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Export All Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Download your data in CSV or JSON format</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Transactions (CSV)', onClick: exportTransactions },
                { label: 'Habits + Logs (CSV)', onClick: exportHabits },
                { label: 'Goals (CSV)', onClick: exportGoals },
                { label: 'Notes (JSON)', onClick: exportNotes },
                { label: 'Reminders (CSV)', onClick: exportReminders },
              ].map(({ label, onClick }) => (
                <Button key={label} variant="outline" size="sm" onClick={onClick} className="justify-start text-left">
                  <Download className="w-3 h-3 mr-2 flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Permanently remove your app data from this account.</p>
            <p className="hidden">
              This will permanently delete <strong>all your data</strong> — habits, transactions, goals, notes, reminders, and more. Your authentication account will remain (contact support to fully remove it).
            </p>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All My Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete All Data
            </AlertDialogTitle>
            <AlertDialogDescription>This deletes your app records and cannot be undone.</AlertDialogDescription>
            <AlertDialogDescription className="hidden">
              This will permanently delete ALL your data including habits, transactions, goals, notes, reminders, bills, accounts, EMIs, savings goals, calendar events, and products. This action <strong>cannot be undone</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAllData}
              disabled={deletingData}
              className="bg-destructive text-destructive-foreground"
            >
              {deletingData ? 'Deleting...' : 'Yes, Delete Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
