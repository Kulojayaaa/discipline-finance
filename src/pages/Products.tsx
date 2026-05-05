import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/CurrencyContext';
import { toast } from 'sonner';
import { Package, AlertTriangle, ShoppingCart, ChevronDown, ChevronUp, Plus, History } from 'lucide-react';
import { AddProductUsageDialog } from '@/components/expenses/AddProductUsageDialog';
import { ProductUsageCard } from '@/components/expenses/ProductUsageCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tables } from '@/integrations/supabase/types';
import { differenceInDays, format } from 'date-fns';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

interface ProductUsage {
  id: string; name: string; category: string; last_purchase_date: string;
  quantity: number | null; unit: string | null; cost: number | null;
  estimated_days: number | null; actual_days: number | null; notes: string | null;
  icon: string | null; color: string | null;
}

interface PurchaseHistory {
  id: string; product_id: string; purchase_date: string;
  quantity: number | null; cost: number | null; unit: string | null;
  notes: string | null; created_at: string;
}

export default function Products() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [products, setProducts] = useState<ProductUsage[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<Record<string, PurchaseHistory[]>>({});
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [logPurchaseProduct, setLogPurchaseProduct] = useState<ProductUsage | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [logForm, setLogForm] = useState({ quantity: '', cost: '', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => {
    if (user) fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('product_usage')
        .select('*')
        .order('last_purchase_date', { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseHistory = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_purchase_history')
        .select('*')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      setPurchaseHistory(prev => ({ ...prev, [productId]: data || [] }));
    } catch {
      toast.error('Failed to load purchase history');
    }
  };

  const toggleHistory = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
    } else {
      setExpandedProduct(productId);
      if (!purchaseHistory[productId]) {
        await fetchPurchaseHistory(productId);
      }
    }
  };

  const logPurchase = async () => {
    if (!logPurchaseProduct || !user) return;
    try {
      const purchaseDate = logForm.date || new Date().toISOString().split('T')[0];

      // Insert into purchase history
      const { error: histError } = await supabase.from('product_purchase_history').insert({
        product_id: logPurchaseProduct.id,
        user_id: user.id,
        purchase_date: purchaseDate,
        quantity: logForm.quantity ? Number(logForm.quantity) : null,
        cost: logForm.cost ? Number(logForm.cost) : null,
        unit: logPurchaseProduct.unit,
        notes: logForm.notes || null,
      });
      if (histError) throw histError;

      // Update product's last_purchase_date and quantity
      const { error: updateError } = await supabase
        .from('product_usage')
        .update({
          last_purchase_date: purchaseDate,
          quantity: logForm.quantity ? Number(logForm.quantity) : logPurchaseProduct.quantity,
          cost: logForm.cost ? Number(logForm.cost) : logPurchaseProduct.cost,
        })
        .eq('id', logPurchaseProduct.id);
      if (updateError) throw updateError;

      toast.success('Purchase logged!');
      setLogPurchaseProduct(null);
      setLogForm({ quantity: '', cost: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchProducts();
      // Refresh history if expanded
      if (expandedProduct === logPurchaseProduct.id) {
        fetchPurchaseHistory(logPurchaseProduct.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to log purchase');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await supabase.from('product_purchase_history').delete().eq('product_id', id);
      const { error } = await supabase.from('product_usage').delete().eq('id', id);
      if (error) throw error;
      toast.success('Product deleted');
      setDeletingProductId(null);
      fetchProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const categories = [...new Set(products.map(p => p.category))];
  const filtered = categoryFilter === 'all' ? products : products.filter(p => p.category === categoryFilter);

  const dueForRepurchase = products.filter(p => {
    if (!p.estimated_days) return false;
    return differenceInDays(new Date(), new Date(p.last_purchase_date)) >= p.estimated_days;
  });

  const deletingProduct = products.find(p => p.id === deletingProductId);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Package className="w-8 h-8 text-primary" />
              Product Tracker
            </h1>
            <p className="text-muted-foreground">Track consumables and know when to repurchase</p>
          </div>
          <AddProductUsageDialog onProductAdded={fetchProducts} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due for Repurchase</p>
                <p className="text-2xl font-bold text-red-500">{dueForRepurchase.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{categories.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        {categories.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Products Grid + expandable history */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard count={3} />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                {products.length === 0 ? 'Track consumables like rice, gas, detergent!' : 'No products in this category.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map(product => (
              <div key={product.id} className="space-y-2">
                <ProductUsageCard
                  product={product}
                  onDelete={(id) => setDeletingProductId(id)}
                  onRefresh={fetchProducts}
                />
                {/* Purchase history expander */}
                <div className="px-1">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHistory(product.id)}
                      className="text-xs text-muted-foreground"
                    >
                      <History className="w-3 h-3 mr-1" />
                      Purchase History
                      {expandedProduct === product.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLogPurchaseProduct(product)}
                      className="text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Log Purchase
                    </Button>
                  </div>

                  {expandedProduct === product.id && (
                    <Card className="mt-2">
                      <CardContent className="p-4">
                        {!purchaseHistory[product.id] ? (
                          <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : purchaseHistory[product.id].length === 0 ? (
                          <p className="text-sm text-muted-foreground">No purchase history yet.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purchase History</p>
                            <div className="divide-y divide-border">
                              {purchaseHistory[product.id].map(ph => (
                                <div key={ph.id} className="flex items-center justify-between py-2 text-sm">
                                  <div>
                                    <p className="font-medium">{format(new Date(ph.purchase_date), 'dd MMM yyyy')}</p>
                                    {ph.notes && <p className="text-xs text-muted-foreground">{ph.notes}</p>}
                                  </div>
                                  <div className="text-right">
                                    {ph.quantity && <p className="text-muted-foreground">{ph.quantity} {ph.unit || ''}</p>}
                                    {ph.cost && <p className="font-semibold">{formatCurrency(ph.cost)}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Purchase Dialog */}
      <Dialog open={!!logPurchaseProduct} onOpenChange={o => { if (!o) setLogPurchaseProduct(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Purchase — {logPurchaseProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <Input type="date" value={logForm.date} onChange={e => setLogForm({ ...logForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Quantity ({logPurchaseProduct?.unit || 'units'})</Label>
                <Input type="number" value={logForm.quantity} onChange={e => setLogForm({ ...logForm, quantity: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input type="number" value={logForm.cost} onChange={e => setLogForm({ ...logForm, cost: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} placeholder="e.g., bought from BigBazaar" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setLogPurchaseProduct(null)}>Cancel</Button>
              <Button className="flex-1" onClick={logPurchase}>Log Purchase</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingProductId} onOpenChange={o => { if (!o) setDeletingProductId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProduct?.name}"? All purchase history will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingProductId && deleteProduct(deletingProductId)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
