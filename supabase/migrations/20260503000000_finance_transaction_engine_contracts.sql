-- Production finance engine contract:
-- transactions are the ledger, balances/budget usage/goal progress are derived.

-- Accounts keep only opening balance as authoritative stored money.
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS initial_balance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.accounts
DROP CONSTRAINT IF EXISTS accounts_initial_balance_non_negative;

ALTER TABLE public.accounts
ADD CONSTRAINT accounts_initial_balance_non_negative
CHECK (initial_balance >= 0);

-- Categories needed by linked system transactions.
INSERT INTO public.categories (user_id, name, type, icon, color, is_default)
SELECT users.user_id, 'Transfer', 'expense', 'Tf', '#2563EB', true
FROM (
  SELECT DISTINCT user_id FROM public.accounts
  UNION
  SELECT DISTINCT user_id FROM public.transactions
) users
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = users.user_id
    AND LOWER(c.name) = 'transfer'
    AND c.type = 'expense'
);

-- Transactions must link to account/category/reference metadata.
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS source_module text NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS reference_type text NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS reference_id uuid,
ADD COLUMN IF NOT EXISTS to_account_id uuid REFERENCES public.accounts(id),
ADD COLUMN IF NOT EXISTS spending_type text;

UPDATE public.transactions
SET reference_type = CASE
  WHEN source_module IN ('emi', 'goal', 'transfer') THEN source_module
  WHEN source_module = 'savings' THEN 'goal'
  ELSE 'manual'
END
WHERE reference_type IS NULL OR reference_type = 'manual';

UPDATE public.transactions t
SET category_id = c.id
FROM public.categories c
WHERE t.category_id IS NULL
  AND t.type = 'transfer'
  AND c.user_id = t.user_id
  AND c.type = 'expense'
  AND LOWER(c.name) = 'transfer';

UPDATE public.transactions t
SET category_id = c.id
FROM public.categories c
WHERE t.category_id IS NULL
  AND t.type = 'credit'
  AND c.user_id = t.user_id
  AND c.type = 'income'
  AND LOWER(c.name) = LOWER(COALESCE(NULLIF(t.category, ''), 'Other Income'));

UPDATE public.transactions t
SET category_id = c.id
FROM public.categories c
WHERE t.category_id IS NULL
  AND t.type = 'debit'
  AND c.user_id = t.user_id
  AND c.type = 'expense'
  AND LOWER(c.name) = LOWER(COALESCE(NULLIF(t.category, ''), 'Other Expense'));

ALTER TABLE public.transactions
ALTER COLUMN account_id SET NOT NULL,
ALTER COLUMN category_id SET NOT NULL,
ALTER COLUMN amount SET NOT NULL;

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_amount_positive,
DROP CONSTRAINT IF EXISTS transactions_type_check,
DROP CONSTRAINT IF EXISTS transactions_reference_type_check,
DROP CONSTRAINT IF EXISTS transactions_transfer_target_check,
DROP CONSTRAINT IF EXISTS transactions_spending_type_check;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0),
ADD CONSTRAINT transactions_type_check CHECK (type IN ('credit', 'debit', 'transfer')),
ADD CONSTRAINT transactions_reference_type_check CHECK (reference_type IN ('manual', 'emi', 'goal', 'transfer')),
ADD CONSTRAINT transactions_transfer_target_check CHECK (
  (type = 'transfer' AND to_account_id IS NOT NULL AND to_account_id <> account_id)
  OR (type <> 'transfer' AND to_account_id IS NULL)
),
ADD CONSTRAINT transactions_spending_type_check CHECK (spending_type IS NULL OR spending_type IN ('self', 'family'));

CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_account_idx ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS transactions_category_idx ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS transactions_reference_idx ON public.transactions(reference_type, reference_id);

-- Budgets must link to expense categories. Usage remains derived from transactions.
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'monthly';

UPDATE public.budgets b
SET category_id = c.id
FROM public.categories c
WHERE b.category_id IS NULL
  AND c.user_id = b.user_id
  AND c.type = 'expense'
  AND LOWER(c.name) = LOWER(b.category);

ALTER TABLE public.budgets
ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE public.budgets
DROP CONSTRAINT IF EXISTS budgets_period_check,
DROP CONSTRAINT IF EXISTS budgets_amount_positive;

ALTER TABLE public.budgets
ADD CONSTRAINT budgets_period_check CHECK (period IN ('monthly', 'yearly')),
ADD CONSTRAINT budgets_amount_positive CHECK (amount > 0);

CREATE UNIQUE INDEX IF NOT EXISTS budgets_user_category_period_idx
ON public.budgets(user_id, category_id, month, year, period);

-- EMI links: EMI -> payment schedule -> transaction -> account.
ALTER TABLE public.emis
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id),
ADD COLUMN IF NOT EXISTS auto_create_transaction boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS next_due_date date;

UPDATE public.emis e
SET account_id = a.id
FROM public.accounts a
WHERE e.account_id IS NULL
  AND a.user_id = e.user_id
  AND a.is_active = true;

UPDATE public.emis e
SET next_due_date = p.due_date
FROM (
  SELECT DISTINCT ON (emi_id) emi_id, due_date
  FROM public.emi_payments
  WHERE is_paid = false
  ORDER BY emi_id, due_date
) p
WHERE e.id = p.emi_id
  AND e.next_due_date IS NULL;

ALTER TABLE public.emi_payments
ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

-- Savings goals link to accounts; saved amount is derived from goal transactions.
ALTER TABLE public.savings_goals
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);

UPDATE public.savings_goals g
SET account_id = a.id
FROM public.accounts a
WHERE g.account_id IS NULL
  AND a.user_id = g.user_id
  AND a.is_active = true;

ALTER TABLE public.savings_goals
DROP CONSTRAINT IF EXISTS savings_goals_target_amount_positive;

ALTER TABLE public.savings_goals
ADD CONSTRAINT savings_goals_target_amount_positive CHECK (target_amount > 0);

-- Retire any running-balance trigger left from older versions.
DROP TRIGGER IF EXISTS on_transaction_change ON public.transactions;
DROP FUNCTION IF EXISTS public.handle_transaction_change();
