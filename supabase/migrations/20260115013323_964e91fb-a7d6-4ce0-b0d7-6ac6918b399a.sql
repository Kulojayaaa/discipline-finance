-- Create product purchase history table
CREATE TABLE public.product_purchase_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.product_usage(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC,
  unit TEXT,
  cost NUMERIC,
  days_lasted INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_purchase_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own product_purchase_history" ON public.product_purchase_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own product_purchase_history" ON public.product_purchase_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own product_purchase_history" ON public.product_purchase_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own product_purchase_history" ON public.product_purchase_history FOR DELETE USING (auth.uid() = user_id);

-- Create bill payment history table
CREATE TABLE public.bill_payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bill_payment_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own bill_payment_history" ON public.bill_payment_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bill_payment_history" ON public.bill_payment_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bill_payment_history" ON public.bill_payment_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bill_payment_history" ON public.bill_payment_history FOR DELETE USING (auth.uid() = user_id);