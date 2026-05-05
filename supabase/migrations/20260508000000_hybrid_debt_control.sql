-- Hybrid debt control: ledger-derived debt movement plus manual corrections.

ALTER TABLE public.debt_tracker
  ADD COLUMN IF NOT EXISTS auto_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_borrowed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_borrowed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_mode text NOT NULL DEFAULT 'auto';

UPDATE public.debt_tracker
SET
  manual_paid = COALESCE(NULLIF(manual_paid, 0), paid_amount, 0),
  manual_borrowed = COALESCE(NULLIF(manual_borrowed, 0), borrowed_amount, 0),
  opening_balance_mode = COALESCE(opening_balance_mode, 'manual')
WHERE (manual_paid = 0 AND COALESCE(paid_amount, 0) <> 0)
   OR (manual_borrowed = 0 AND COALESCE(borrowed_amount, 0) <> 0)
   OR opening_balance_mode IS NULL;

UPDATE public.debt_tracker
SET
  paid_amount = COALESCE(auto_paid, 0) + COALESCE(manual_paid, 0),
  borrowed_amount = COALESCE(auto_borrowed, 0) + COALESCE(manual_borrowed, 0),
  closing_balance = COALESCE(opening_balance, 0)
    - (COALESCE(auto_paid, 0) + COALESCE(manual_paid, 0))
    + (COALESCE(auto_borrowed, 0) + COALESCE(manual_borrowed, 0));

ALTER TABLE public.debt_tracker
  DROP CONSTRAINT IF EXISTS debt_tracker_opening_balance_mode_check,
  ADD CONSTRAINT debt_tracker_opening_balance_mode_check CHECK (opening_balance_mode IN ('auto', 'manual'));

CREATE OR REPLACE FUNCTION public.sync_debt_tracker_hybrid_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.auto_paid := COALESCE(NEW.auto_paid, 0);
  NEW.manual_paid := COALESCE(NEW.manual_paid, 0);
  NEW.auto_borrowed := COALESCE(NEW.auto_borrowed, 0);
  NEW.manual_borrowed := COALESCE(NEW.manual_borrowed, 0);
  NEW.opening_balance := COALESCE(NEW.opening_balance, 0);
  NEW.opening_balance_mode := COALESCE(NEW.opening_balance_mode, 'auto');
  NEW.paid_amount := NEW.auto_paid + NEW.manual_paid;
  NEW.borrowed_amount := NEW.auto_borrowed + NEW.manual_borrowed;
  NEW.closing_balance := NEW.opening_balance - NEW.paid_amount + NEW.borrowed_amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS debt_tracker_sync_hybrid_columns ON public.debt_tracker;
CREATE TRIGGER debt_tracker_sync_hybrid_columns
  BEFORE INSERT OR UPDATE ON public.debt_tracker
  FOR EACH ROW EXECUTE FUNCTION public.sync_debt_tracker_hybrid_columns();

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'self';

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_type_check,
  ADD CONSTRAINT budgets_type_check CHECK (type IN ('self', 'family'));

INSERT INTO public.categories (user_id, name, type, icon, color, is_default)
SELECT users.user_id, 'Borrowed', 'income', 'Br', '#9333EA', true
FROM (
  SELECT DISTINCT user_id FROM public.accounts
  UNION
  SELECT DISTINCT user_id FROM public.transactions
  UNION
  SELECT DISTINCT user_id FROM public.categories
  UNION
  SELECT DISTINCT user_id FROM public.debt_tracker
) AS users
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = users.user_id
    AND LOWER(c.name) = 'borrowed'
    AND c.type = 'income'
);

CREATE INDEX IF NOT EXISTS debt_tracker_user_month_desc_idx
ON public.debt_tracker(user_id, month DESC);
