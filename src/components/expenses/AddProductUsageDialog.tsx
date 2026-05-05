import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Package, Plus } from 'lucide-react';
import { useCurrency } from '@/hooks/CurrencyContext';

const PRODUCT_CATEGORIES = ['groceries', 'household', 'personal care', 'kitchen', 'cleaning', 'other'];
const UNITS = ['kg', 'liters', 'pieces', 'packs', 'bottles', 'boxes', 'grams', 'ml'];
const ICONS = ['📦', '🛒', '🍚', '🧴', '🧹', '⛽', '🥛', '🧈', '🧼', '🧻'];

interface AddProductUsageDialogProps {
  onProductAdded: () => void;
}

export function AddProductUsageDialog({ onProductAdded }: AddProductUsageDialogProps) {
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const quantity = formData.get('quantity') as string;
    const unit = formData.get('unit') as string;
    const cost = formData.get('cost') as string;
    const estimatedDays = formData.get('estimatedDays') as string;
    const lastPurchaseDate = formData.get('lastPurchaseDate') as string;
    const notes = formData.get('notes') as string;
    const icon = formData.get('icon') as string;

    if (!name || !category) {
      toast.error('Please fill required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('product_usage').insert({
        user_id: user.id,
        name,
        category,
        quantity: quantity ? parseFloat(quantity) : null,
        unit: unit || null,
        cost: cost ? parseFloat(cost) : null,
        estimated_days: estimatedDays ? parseInt(estimatedDays) : null,
        last_purchase_date: lastPurchaseDate || new Date().toISOString().split('T')[0],
        notes: notes || null,
        icon: icon || '📦',
      });

      if (error) throw error;
      toast.success('Product added!');
      setOpen(false);
      onProductAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Package className="w-4 h-4" />
          <Plus className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Add Product
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-3">
              <Label htmlFor="name">Product Name *</Label>
              <Input id="name" name="name" placeholder="e.g., Rice, Gas Cylinder" required />
            </div>
            <div>
              <Label htmlFor="icon">Icon</Label>
              <Select name="icon" defaultValue="📦">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICONS.map(icon => (
                    <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select name="category" required defaultValue="groceries">
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" step="0.01" placeholder="e.g., 5" />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select name="unit">
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cost">Cost ({currencySymbol})</Label>
              <Input id="cost" name="cost" type="number" step="0.01" placeholder="e.g., 500" />
            </div>
            <div>
              <Label htmlFor="estimatedDays">Estimated Days</Label>
              <Input id="estimatedDays" name="estimatedDays" type="number" placeholder="e.g., 30" />
            </div>
          </div>

          <div>
            <Label htmlFor="lastPurchaseDate">Last Purchase Date</Label>
            <Input 
              id="lastPurchaseDate" 
              name="lastPurchaseDate" 
              type="date" 
              defaultValue={new Date().toISOString().split('T')[0]} 
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Any additional notes..." rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : 'Add Product'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
