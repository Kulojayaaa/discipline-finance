
-- Create product_usage table for tracking consumable products
CREATE TABLE public.product_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'groceries',
  last_purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC,
  unit TEXT,
  cost NUMERIC,
  estimated_days INTEGER,
  actual_days INTEGER,
  notes TEXT,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#10B981',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bills table for tracking recurring bills
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  provider TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  is_recurring BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3,
  last_paid_date DATE,
  is_paid BOOLEAN DEFAULT false,
  notes TEXT,
  icon TEXT DEFAULT '📄',
  color TEXT DEFAULT '#F59E0B',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.product_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_usage
CREATE POLICY "Users can view own product_usage" ON public.product_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own product_usage" ON public.product_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own product_usage" ON public.product_usage FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own product_usage" ON public.product_usage FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for bills
CREATE POLICY "Users can view own bills" ON public.bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bills" ON public.bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bills" ON public.bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bills" ON public.bills FOR DELETE USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_product_usage_updated_at BEFORE UPDATE ON public.product_usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
