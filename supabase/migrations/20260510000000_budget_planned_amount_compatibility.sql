-- Budget amount compatibility for generated clients that use planned_amount.
-- The canonical app column remains amount; aliases are kept in sync.

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS planned_amount numeric;

UPDATE public.budgets
SET planned_amount = COALESCE(planned_amount, limit_amount, monthly_limit, amount, 0);

ALTER TABLE public.budgets
  ALTER COLUMN planned_amount SET DEFAULT 0,
  ALTER COLUMN planned_amount SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_budget_amount_aliases()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.amount := COALESCE(NEW.amount, NEW.planned_amount, NEW.limit_amount, NEW.monthly_limit, 0);
  NEW.planned_amount := COALESCE(NEW.planned_amount, NEW.amount, NEW.limit_amount, NEW.monthly_limit, 0);
  NEW.limit_amount := COALESCE(NEW.limit_amount, NEW.amount, NEW.planned_amount, NEW.monthly_limit, 0);
  NEW.monthly_limit := COALESCE(NEW.monthly_limit, NEW.amount, NEW.planned_amount, NEW.limit_amount, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budgets_sync_amount_aliases ON public.budgets;
CREATE TRIGGER budgets_sync_amount_aliases
  BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.sync_budget_amount_aliases();

NOTIFY pgrst, 'reload schema';
