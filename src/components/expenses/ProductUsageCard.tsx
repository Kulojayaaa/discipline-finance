import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trash2, RefreshCw, Calendar, Clock, ShoppingCart, ChevronDown, History } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/CurrencyContext';

interface PurchaseHistory {
  id: string;
  purchase_date: string;
  quantity: number | null;
  cost: number | null;
  days_lasted: number | null;
}

interface ProductUsageCardProps {
  product: {
    id: string;
    name: string;
    category: string;
    last_purchase_date: string;
    quantity: number | null;
    unit: string | null;
    cost: number | null;
    estimated_days: number | null;
    actual_days: number | null;
    notes: string | null;
    icon: string | null;
    color: string | null;
  };
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function ProductUsageCard({ product, onDelete, onRefresh }: ProductUsageCardProps) {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [repurchasing, setRepurchasing] = useState(false);
  const [newCost, setNewCost] = useState(product.cost?.toString() || '');
  const [showHistory, setShowHistory] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const daysSinceLastPurchase = differenceInDays(new Date(), new Date(product.last_purchase_date));
  const estimatedNextPurchase = product.estimated_days 
    ? addDays(new Date(product.last_purchase_date), product.estimated_days)
    : null;
  const daysUntilNextPurchase = estimatedNextPurchase 
    ? differenceInDays(estimatedNextPurchase, new Date())
    : null;

  useEffect(() => {
    if (showHistory && purchaseHistory.length === 0) {
      fetchHistory();
    }
  }, [showHistory]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('product_purchase_history')
        .select('*')
        .eq('product_id', product.id)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setPurchaseHistory(data || []);
    } catch (error: any) {
      toast.error('Failed to load purchase history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getStatusColor = () => {
    if (daysUntilNextPurchase === null) return 'bg-muted text-muted-foreground';
    if (daysUntilNextPurchase <= 0) return 'bg-red-500/10 text-red-500';
    if (daysUntilNextPurchase <= 3) return 'bg-orange-500/10 text-orange-500';
    if (daysUntilNextPurchase <= 7) return 'bg-yellow-500/10 text-yellow-500';
    return 'bg-green-500/10 text-green-500';
  };

  const handleRepurchase = async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const actualDays = daysSinceLastPurchase;

      // Save to purchase history
      const { error: historyError } = await supabase
        .from('product_purchase_history')
        .insert({
          product_id: product.id,
          user_id: user.id,
          purchase_date: today,
          quantity: product.quantity,
          cost: newCost ? parseFloat(newCost) : product.cost,
          days_lasted: actualDays,
        });

      if (historyError) throw historyError;

      // Update product
      const { error } = await supabase
        .from('product_usage')
        .update({
          last_purchase_date: today,
          actual_days: actualDays,
          cost: newCost ? parseFloat(newCost) : product.cost,
          estimated_days: actualDays > 0 ? actualDays : product.estimated_days,
        })
        .eq('id', product.id);

      if (error) throw error;
      toast.success(`${product.name} repurchased! Updated usage pattern.`);
      setRepurchasing(false);
      setPurchaseHistory([]);
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to update product');
    }
  };

  return (
    <Card className="border-border hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: `${product.color || '#10B981'}20` }}
            >
              {product.icon || '📦'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">{product.name}</h4>
              <p className="text-sm text-muted-foreground capitalize">{product.category}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onDelete(product.id)} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Last bought:</span>
            <span className="font-medium">{format(new Date(product.last_purchase_date), 'dd MMM yyyy')}</span>
            <Badge variant="outline" className="text-xs">
              {daysSinceLastPurchase} days ago
            </Badge>
          </div>

          {product.quantity && product.unit && (
            <div className="flex items-center gap-2 text-sm">
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-medium">{product.quantity} {product.unit}</span>
              {product.cost && <span className="text-muted-foreground">• {formatCurrency(product.cost)}</span>}
            </div>
          )}

          {estimatedNextPurchase && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Next purchase:</span>
              <Badge className={`${getStatusColor()} border-0`}>
                {daysUntilNextPurchase! <= 0 
                  ? `${Math.abs(daysUntilNextPurchase!)} days overdue`
                  : `in ${daysUntilNextPurchase} days`
                }
              </Badge>
            </div>
          )}

          {product.actual_days && (
            <div className="text-xs text-muted-foreground">
              Avg usage: ~{product.actual_days} days per purchase
            </div>
          )}
        </div>

        {repurchasing ? (
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="number"
              placeholder="New cost"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              className="h-8"
            />
            <Button size="sm" onClick={handleRepurchase}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setRepurchasing(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setRepurchasing(true)}
            >
              <RefreshCw className="w-4 h-4" />
              Mark Repurchased
            </Button>

            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                  <History className="w-4 h-4" />
                  Purchase History
                  <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                {loadingHistory ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>
                ) : purchaseHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No previous purchases</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {purchaseHistory.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                        <span>{format(new Date(h.purchase_date), 'dd MMM yyyy')}</span>
                        <div className="flex items-center gap-2">
                          {h.cost && <span className="text-muted-foreground">{formatCurrency(h.cost)}</span>}
                          {h.days_lasted && (
                            <Badge variant="secondary" className="text-xs">
                              {h.days_lasted} days
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
