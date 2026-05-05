-- Normalize the finance domain for computed balances, category foreign keys,
-- transaction-linked EMI payments, and discipline planning tables.

-- 1. Accounts: store opening balance only and compute live balances from transactions.
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS initial_balance numeric NOT NULL DEFAULT 0;

WITH account_net AS (
  SELECT
    a.id,
    COALESCE(SUM(
      CASE
        WHEN t.account_id = a.id AND t.type = 'credit' THEN t.amount
        WHEN t.account_id = a.id AND t.type IN ('debit', 'transfer') THEN -t.amount
        WHEN t.to_account_id = a.id AND t.type = 'transfer' THEN t.amount
        ELSE 0
      END
    ), 0) AS tx_impact
  FROM public.accounts a
  LEFT JOIN public.transactions t
    ON t.account_id = a.id
    OR t.to_account_id = a.id
  GROUP BY a.id
)
UPDATE public.accounts a
SET initial_balance = COALESCE(a.balance, 0) - account_net.tx_impact
FROM account_net
WHERE a.id = account_net.id
  AND COALESCE(a.initial_balance, 0) = 0;

-- Retire the running-balance trigger. Existing balance column remains only for legacy compatibility.
DROP TRIGGER IF EXISTS on_transaction_change ON public.transactions;
DROP FUNCTION IF EXISTS public.handle_transaction_change();

-- 2. Categories: enforce per-user uniqueness and seed required defaults.
ALTER TABLE public.categories
ADD CONSTRAINT categories_user_name_type_unique UNIQUE (user_id, name, type);

INSERT INTO public.categories (user_id, name, type, icon, color, is_default)
SELECT
  users.user_id,
  defaults.name,
  defaults.type,
  defaults.icon,
  defaults.color,
  true
FROM (
  SELECT DISTINCT user_id FROM public.accounts
  UNION
  SELECT DISTINCT user_id FROM public.transactions
  UNION
  SELECT DISTINCT user_id FROM public.categories
) AS users
CROSS JOIN (
  VALUES
    ('Salary', 'income', 'Rs', '#16A34A'),
    ('Freelance', 'income', 'Fx', '#0284C7'),
    ('Investment', 'income', 'Iv', '#7C3AED'),
    ('Gift', 'income', 'Gt', '#DB2777'),
    ('Refund', 'income', 'Rf', '#0F766E'),
    ('Other Income', 'income', 'Oi', '#4B5563'),
    ('Food & Dining', 'expense', 'Fd', '#F97316'),
    ('Transportation', 'expense', 'Tr', '#2563EB'),
    ('Utilities', 'expense', 'Ut', '#EAB308'),
    ('Entertainment', 'expense', 'En', '#EC4899'),
    ('Shopping', 'expense', 'Sh', '#8B5CF6'),
    ('Health', 'expense', 'He', '#EF4444'),
    ('Education', 'expense', 'Ed', '#14B8A6'),
    ('Rent', 'expense', 'Re', '#6D28D9'),
    ('Insurance', 'expense', 'In', '#0EA5E9'),
    ('Subscriptions', 'expense', 'Sb', '#6366F1'),
    ('Bills', 'expense', 'Bl', '#DC2626'),
    ('EMI', 'expense', 'Em', '#B91C1C'),
    ('Savings', 'expense', 'Sv', '#059669'),
    ('Debt Payment', 'expense', 'Dp', '#7C2D12'),
    ('Other Expense', 'expense', 'Ot', '#6B7280')
) AS defaults(name, type, icon, color)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = users.user_id
    AND c.name = defaults.name
    AND c.type = defaults.type
);

-- 3. Transactions: normalize category, add source metadata, add spending split.
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS source_module text NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS reference_id uuid,
ADD COLUMN IF NOT EXISTS spending_type text;

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_spending_type_check;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_spending_type_check
CHECK (spending_type IS NULL OR spending_type IN ('self', 'family'));

WITH missing_categories AS (
  SELECT DISTINCT
    t.user_id,
    CASE
      WHEN t.type = 'credit' THEN COALESCE(NULLIF(t.category, ''), 'Other Income')
      WHEN t.type = 'debit' THEN COALESCE(NULLIF(t.category, ''), 'Other Expense')
      ELSE NULL
    END AS category_name,
    CASE
      WHEN t.type = 'credit' THEN 'income'
      WHEN t.type = 'debit' THEN 'expense'
      ELSE NULL
    END AS category_type
  FROM public.transactions t
  WHERE t.type IN ('credit', 'debit')
)
INSERT INTO public.categories (user_id, name, type, is_default)
SELECT user_id, category_name, category_type, false
FROM missing_categories mc
WHERE mc.category_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.categories c
    WHERE c.user_id = mc.user_id
      AND LOWER(c.name) = LOWER(mc.category_name)
      AND c.type = mc.category_type
  );

UPDATE public.transactions t
SET category_id = c.id
FROM public.categories c
WHERE t.category_id IS NULL
  AND t.type IN ('credit', 'debit')
  AND c.user_id = t.user_id
  AND LOWER(c.name) = LOWER(COALESCE(NULLIF(t.category, ''), CASE WHEN t.type = 'credit' THEN 'Other Income' ELSE 'Other Expense' END))
  AND c.type = CASE WHEN t.type = 'credit' THEN 'income' ELSE 'expense' END;

UPDATE public.transactions
SET spending_type = COALESCE(spending_type, 'self')
WHERE type = 'debit'
  AND spending_type IS NULL;

-- 4. Budgets: attach to categories and add carry-forward support.
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS carry_forward boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS rollover_amount numeric NOT NULL DEFAULT 0;

UPDATE public.budgets b
SET category_id = c.id
FROM public.categories c
WHERE b.category_id IS NULL
  AND c.user_id = b.user_id
  AND c.type = 'expense'
  AND LOWER(c.name) = LOWER(b.category);

-- 5. EMI payments: keep a durable transaction link for safe delete/unmark flows.
ALTER TABLE public.emi_payments
ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

-- 6. Savings goals: link every goal to an account, keep completion derived in the app.
ALTER TABLE public.savings_goals
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);

-- 7. Debt tracker.
CREATE TABLE IF NOT EXISTS public.debt_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  opening_balance numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  borrowed_amount numeric NOT NULL DEFAULT 0,
  closing_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT debt_tracker_month_unique UNIQUE (user_id, month)
);

ALTER TABLE public.debt_tracker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own debt_tracker" ON public.debt_tracker;
DROP POLICY IF EXISTS "Users can insert own debt_tracker" ON public.debt_tracker;
DROP POLICY IF EXISTS "Users can update own debt_tracker" ON public.debt_tracker;
DROP POLICY IF EXISTS "Users can delete own debt_tracker" ON public.debt_tracker;

CREATE POLICY "Users can view own debt_tracker" ON public.debt_tracker
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debt_tracker" ON public.debt_tracker
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debt_tracker" ON public.debt_tracker
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own debt_tracker" ON public.debt_tracker
FOR DELETE USING (auth.uid() = user_id);

-- 8. Monthly cash-flow planner.
CREATE TABLE IF NOT EXISTS public.monthly_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  total_income numeric NOT NULL DEFAULT 0,
  allocated_self numeric NOT NULL DEFAULT 0,
  allocated_family numeric NOT NULL DEFAULT 0,
  allocated_debt numeric NOT NULL DEFAULT 0,
  remaining_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_plan_month_unique UNIQUE (user_id, month)
);

ALTER TABLE public.monthly_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own monthly_plan" ON public.monthly_plan;
DROP POLICY IF EXISTS "Users can insert own monthly_plan" ON public.monthly_plan;
DROP POLICY IF EXISTS "Users can update own monthly_plan" ON public.monthly_plan;
DROP POLICY IF EXISTS "Users can delete own monthly_plan" ON public.monthly_plan;

CREATE POLICY "Users can view own monthly_plan" ON public.monthly_plan
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly_plan" ON public.monthly_plan
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly_plan" ON public.monthly_plan
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly_plan" ON public.monthly_plan
FOR DELETE USING (auth.uid() = user_id);

-- 9. Updated-at triggers for new tables.
CREATE OR REPLACE FUNCTION public.set_finance_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS debt_tracker_set_updated_at ON public.debt_tracker;
CREATE TRIGGER debt_tracker_set_updated_at
BEFORE UPDATE ON public.debt_tracker
FOR EACH ROW EXECUTE FUNCTION public.set_finance_updated_at();

DROP TRIGGER IF EXISTS monthly_plan_set_updated_at ON public.monthly_plan;
CREATE TRIGGER monthly_plan_set_updated_at
BEFORE UPDATE ON public.monthly_plan
FOR EACH ROW EXECUTE FUNCTION public.set_finance_updated_at();
