-- Post-contract repairs + integrity hardening (run after 20260503000000_finance_transaction_engine_contracts.sql).

-- 1) Drop redundant unique index on categories (named UNIQUE constraint from 20260501 covers this).
DROP INDEX IF EXISTS public.idx_categories_unique_name;

-- 2) Repair any legacy rows that could block constraints after migrations (idempotent).
UPDATE public.savings_goals SET target_amount = 1 WHERE target_amount IS NOT NULL AND target_amount <= 0;

UPDATE public.transactions t
SET category_id = c.id
FROM public.categories c
WHERE t.category_id IS NULL
  AND t.type IN ('credit', 'debit')
  AND c.user_id = t.user_id
  AND LOWER(c.name) = LOWER(COALESCE(NULLIF(t.category, ''), CASE WHEN t.type = 'credit' THEN 'Other Income' ELSE 'Other Expense' END))
  AND c.type = CASE WHEN t.type = 'credit' THEN 'income' ELSE 'expense' END;

UPDATE public.transactions t
SET category_id = c.id
FROM public.categories c
WHERE t.category_id IS NULL
  AND t.type = 'transfer'
  AND c.user_id = t.user_id
  AND c.type = 'expense'
  AND LOWER(c.name) = 'transfer';

-- 3) Passwords: keep updated_at fresh on row updates.
DROP TRIGGER IF EXISTS update_passwords_updated_at ON public.passwords;
CREATE TRIGGER update_passwords_updated_at
  BEFORE UPDATE ON public.passwords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Useful indexes for common filters (optional perf wins).
CREATE INDEX IF NOT EXISTS habits_user_id_idx ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON public.reminders(user_id);

-- 5) Foreign keys on user_id -> auth.users (NOT VALID first to avoid failing on rare orphans; validate after).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_user_id_fkey'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.categories VALIDATE CONSTRAINT categories_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_user_id_fkey') THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.goals VALIDATE CONSTRAINT goals_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goal_updates_user_id_fkey') THEN
    ALTER TABLE public.goal_updates
      ADD CONSTRAINT goal_updates_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.goal_updates VALIDATE CONSTRAINT goal_updates_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goal_milestones_user_id_fkey') THEN
    ALTER TABLE public.goal_milestones
      ADD CONSTRAINT goal_milestones_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.goal_milestones VALIDATE CONSTRAINT goal_milestones_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_user_id_fkey') THEN
    ALTER TABLE public.bills
      ADD CONSTRAINT bills_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.bills VALIDATE CONSTRAINT bills_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_usage_user_id_fkey') THEN
    ALTER TABLE public.product_usage
      ADD CONSTRAINT product_usage_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.product_usage VALIDATE CONSTRAINT product_usage_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_purchase_history_user_id_fkey') THEN
    ALTER TABLE public.product_purchase_history
      ADD CONSTRAINT product_purchase_history_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.product_purchase_history VALIDATE CONSTRAINT product_purchase_history_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bill_payment_history_user_id_fkey') THEN
    ALTER TABLE public.bill_payment_history
      ADD CONSTRAINT bill_payment_history_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.bill_payment_history VALIDATE CONSTRAINT bill_payment_history_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debt_tracker_user_id_fkey') THEN
    ALTER TABLE public.debt_tracker
      ADD CONSTRAINT debt_tracker_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.debt_tracker VALIDATE CONSTRAINT debt_tracker_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_plan_user_id_fkey') THEN
    ALTER TABLE public.monthly_plan
      ADD CONSTRAINT monthly_plan_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.monthly_plan VALIDATE CONSTRAINT monthly_plan_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_user_id_fkey') THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.notes VALIDATE CONSTRAINT notes_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_user_id_fkey') THEN
    ALTER TABLE public.reminders
      ADD CONSTRAINT reminders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.reminders VALIDATE CONSTRAINT reminders_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_user_id_fkey') THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.calendar_events VALIDATE CONSTRAINT calendar_events_user_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'passwords_user_id_fkey') THEN
    ALTER TABLE public.passwords
      ADD CONSTRAINT passwords_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.passwords VALIDATE CONSTRAINT passwords_user_id_fkey;
  END IF;
END $$;
