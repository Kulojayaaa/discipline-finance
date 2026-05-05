-- Allow separate self and family budgets for the same category/month.

DROP INDEX IF EXISTS public.budgets_user_category_period_idx;

CREATE UNIQUE INDEX IF NOT EXISTS budgets_user_category_type_period_idx
ON public.budgets(user_id, category_id, type, month, year, period);
