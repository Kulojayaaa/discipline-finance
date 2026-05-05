import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Tags } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

interface AddCategoryDialogProps {
  onCategoryChanged: () => void;
}

export function AddCategoryDialog({ onCategoryChanged }: AddCategoryDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    icon: '📁',
    color: '#8B5CF6',
  });

  const fetchCategories = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('type')
      .order('name');
    if (!error && data) {
      setCategories(data as Category[]);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchCategories();
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('categories').insert({
        user_id: user.id,
        name: formData.name.trim(),
        type: formData.type,
        icon: formData.icon,
        color: formData.color,
      });

      if (error) throw error;

      toast.success('Category added!');
      setFormData({ name: '', type: 'expense', icon: '📁', color: '#8B5CF6' });
      fetchCategories();
      onCategoryChanged();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast.success('Category deleted');
      fetchCategories();
      onCategoryChanged();
    } catch (error: any) {
      toast.error('Failed to delete category');
    }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Tags className="w-4 h-4 mr-2" />
          Manage Categories
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Groceries"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as 'income' | 'expense' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            <Plus className="w-4 h-4 mr-2" />
            {loading ? 'Adding...' : 'Add Category'}
          </Button>
        </form>

        <div className="space-y-4 mt-4">
          {expenseCategories.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Expense Categories</h4>
              <div className="space-y-1">
                {expenseCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm">{cat.icon} {cat.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {incomeCategories.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Income Categories</h4>
              <div className="space-y-1">
                {incomeCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm">{cat.icon} {cat.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom categories yet. Default categories will be used.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}