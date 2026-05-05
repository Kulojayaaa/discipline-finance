import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, Key, Plus, Copy, Trash2, Eye, EyeOff, Search, ExternalLink, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface PasswordEntry {
  id: string;
  title: string;
  username: string | null;
  password_value: string;
  url: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

const VAULT_KEY_STORAGE = 'fintrack:vault-master-key';

export default function Vault() {
  const { user } = useAuth();
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [masterKey, setMasterKey] = useState(() => localStorage.getItem(VAULT_KEY_STORAGE) || '');
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  
  // Dialog state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '', username: '', password_value: '', url: '', notes: ''
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // UI state
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPasswords([]);
    setShowPasswordMap({});
    setVaultUnlocked(false);
    setLoading(false);
    setMasterKey(localStorage.getItem(VAULT_KEY_STORAGE) || '');
  }, [user]);

  const fetchPasswords = async (key = masterKey) => {
    if (!key) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('list_passwords', { vault_key: key });
      if (error) throw error;
      setPasswords(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlock password vault');
    } finally {
      setLoading(false);
    }
  };

  const unlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey) {
      toast.error('Enter your vault key');
      return;
    }

    setLoading(true);
    try {
      const { data: migrated, error: migrateError } = await supabase.rpc('migrate_legacy_passwords', { vault_key: masterKey });
      if (migrateError) throw migrateError;
      localStorage.setItem(VAULT_KEY_STORAGE, masterKey);
      await fetchPasswords(masterKey);
      setVaultUnlocked(true);
      if (migrated && migrated > 0) {
        toast.success(`${migrated} legacy vault item${migrated === 1 ? '' : 's'} encrypted`);
      } else {
        toast.success('Vault unlocked');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlock vault. Check that the encryption migration has run.');
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.rpc('delete_password', { entry_id: deleteId });
      if (error) throw error;
      toast.success('Deleted successfully');
      setDeleteId(null);
      fetchPasswords();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!vaultUnlocked || !masterKey) {
      toast.error('Unlock the vault before saving');
      return;
    }
    if (!formData.title || !formData.password_value) {
      toast.error('Title and password are required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('save_password', {
        vault_key: masterKey,
        entry_title: formData.title,
        entry_username: formData.username,
        entry_password: formData.password_value,
        entry_url: formData.url,
        entry_notes: formData.notes,
      });
      if (error) throw error;
      toast.success('Saved to vault!');
      setOpen(false);
      setFormData({ title: '', username: '', password_value: '', url: '', notes: '' });
      fetchPasswords();
    } catch (error: any) {
      toast.error('Failed to save to vault');
    } finally {
      setSaving(false);
    }
  };

  const filteredPasswords = passwords.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    (p.username && p.username.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <Alert className="bg-primary/5 border-primary/20">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertTitle>Encrypted vault</AlertTitle>
          <AlertDescription>Use your saved vault key to unlock credentials.</AlertDescription>
        </Alert>

        {!vaultUnlocked && (
          <Card>
            <CardContent className="p-4">
              <form onSubmit={unlockVault} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="vault-master-key">Vault key</Label>
                  <Input
                    id="vault-master-key"
                    type="password"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    placeholder="Enter vault key"
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Unlocking...' : 'Unlock Vault'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              Password Vault
            </h1>
            <p className="text-muted-foreground">Securely store your important credentials</p>
          </div>
          
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
              <Button className="gradient-primary" disabled={!vaultUnlocked}>
                <Plus className="w-4 h-4 mr-2" /> Add Password
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add to Vault</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title / Service Name *</Label>
                  <Input 
                    placeholder="e.g., Netflix, Bank" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username / Email</Label>
                  <Input 
                    placeholder="e.g., user@example.com" 
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input 
                    type="password"
                    placeholder="Enter password" 
                    value={formData.password_value}
                    onChange={e => setFormData({...formData, password_value: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website URL</Label>
                  <Input 
                    type="url"
                    placeholder="https://..." 
                    value={formData.url}
                    onChange={e => setFormData({...formData, url: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Input 
                    placeholder="Any extra details..." 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? 'Saving...' : 'Save to Vault'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search vault..." 
            className="pl-10 max-w-md bg-card border-border"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {!vaultUnlocked ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-xl font-semibold mb-2">Vault locked</h3>
              <p className="text-muted-foreground max-w-sm">
                Enter your vault key to view saved credentials.
              </p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : filteredPasswords.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Key className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-xl font-semibold mb-2">Vault is empty</h3>
              <p className="text-muted-foreground max-w-sm">
                Store your sensitive passwords, pins, and credentials here safely.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPasswords.map(pw => (
              <Card key={pw.id} className="border-border hover:shadow-md transition-all">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Key className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{pw.title}</h4>
                        {pw.url && (
                          <a href={pw.url.startsWith('http') ? pw.url : `https://${pw.url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            {pw.url} <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(pw.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/50">
                    {pw.username && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Username</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{pw.username}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(pw.username!, 'Username')}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Password</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tracking-widest bg-muted px-2 py-1 rounded">
                          {showPasswordMap[pw.id] ? pw.password_value : '••••••••'}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePasswordVisibility(pw.id)}>
                          {showPasswordMap[pw.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(pw.password_value, 'Password')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {pw.notes && (
                      <div className="mt-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                        {pw.notes}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the credentials for <strong>{passwords.find(p => p.id === deleteId)?.title}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
