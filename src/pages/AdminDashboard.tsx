import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Users, UserPlus, Shield, Activity } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

interface UserData {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  phone: string | null;
}

export default function AdminDashboard() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (user && isAdmin) fetchUsers();
  }, [user, isAdmin]);

  const fetchUsers = async () => {
    setFetchError(null);
    try {
      // Get auth user data via security definer function
      const { data: authUsers, error: authError } = await supabase.rpc('get_all_users');
      if (authError) throw authError;

      // Get profiles (admin can see all via RLS policy)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone');
      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const merged: UserData[] = (authUsers || []).map((u: any) => ({
        id: u.id,
        email: u.email || '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: profileMap.get(u.id)?.full_name || null,
        phone: profileMap.get(u.id)?.phone || null,
      }));

      setUsers(merged);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch users';
      setFetchError(msg);
      toast.error(msg);
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const totalUsers = users.length;
  const newThisMonth = users.filter(u => {
    const created = new Date(u.created_at);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;
  const activeRecently = users.filter(u => {
    if (!u.last_sign_in_at) return false;
    return new Date(u.last_sign_in_at) >= subDays(new Date(), 7);
  }).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Manage users and monitor activity</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">New This Month</p>
                <p className="text-2xl font-bold text-foreground">{newThisMonth}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active (7 days)</p>
                <p className="text-2xl font-bold text-foreground">{activeRecently}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Users</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
              </div>
            ) : fetchError ? (
              <p className="text-sm text-destructive py-4">{fetchError}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.full_name || <span className="text-muted-foreground italic">Not set</span>}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        {u.phone || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell>{format(new Date(u.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        {u.last_sign_in_at ? (
                          <Badge variant="secondary">
                            {format(new Date(u.last_sign_in_at), 'dd MMM yyyy')}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground italic">Never</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
