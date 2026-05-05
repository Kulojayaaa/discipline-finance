-- Strict finance schema compatibility layer.
-- Adds the requested production columns without breaking the existing UI contract.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS opening_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_balance numeric NOT NULL DEFAULT 0;

UPDATE public.accounts
SET
  opening_balance = COALESCE(opening_balance, initial_balance, balance, 0),
  current_balance = COALESCE(current_balance, initial_balance, opening_balance, balance, 0);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

UPDATE public.transactions
SET transfer_account_id = COALESCE(transfer_account_id, to_account_id)
WHERE transfer_account_id IS NULL AND to_account_id IS NOT NULL;

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS month_key text,
  ADD COLUMN IF NOT EXISTS limit_amount numeric,
  ADD COLUMN IF NOT EXISTS monthly_limit numeric;

UPDATE public.budgets
SET
  month_key = COALESCE(month_key, year::text || '-' || lpad(month::text, 2, '0')),
  limit_amount = COALESCE(limit_amount, monthly_limit, amount, 0),
  monthly_limit = COALESCE(monthly_limit, limit_amount, amount, 0);

ALTER TABLE public.budgets
  ALTER COLUMN month_key SET NOT NULL,
  ALTER COLUMN limit_amount SET DEFAULT 0,
  ALTER COLUMN limit_amount SET NOT NULL,
  ALTER COLUMN monthly_limit SET DEFAULT 0,
  ALTER COLUMN monthly_limit SET NOT NULL;

ALTER TABLE public.emis
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS tenure_months integer,
  ADD COLUMN IF NOT EXISTS monthly_amount numeric,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS remaining_balance numeric NOT NULL DEFAULT 0;

UPDATE public.emis
SET
  total_amount = COALESCE(total_amount, principal_amount, 0),
  tenure_months = COALESCE(tenure_months, total_months, 0),
  monthly_amount = COALESCE(monthly_amount, emi_amount, 0),
  due_date = COALESCE(due_date, start_date),
  remaining_balance = COALESCE(remaining_balance, principal_amount, total_amount, 0);

ALTER TABLE public.emi_payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

UPDATE public.emi_payments
SET status = CASE
  WHEN is_paid THEN 'paid'
  WHEN due_date < CURRENT_DATE THEN 'overdue'
  ELSE 'pending'
END;

ALTER TABLE public.emi_payments
  DROP CONSTRAINT IF EXISTS emi_payments_status_check,
  ADD CONSTRAINT emi_payments_status_check CHECK (status IN ('pending', 'paid', 'overdue'));

ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS progress_amount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES public.savings_goals(id) ON DELETE CASCADE NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS recurring boolean,
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.bills
SET
  recurring = COALESCE(recurring, is_recurring, false),
  status = COALESCE(status, CASE WHEN is_paid THEN 'paid' ELSE 'pending' END);

ALTER TABLE public.bills
  ALTER COLUMN recurring SET DEFAULT false,
  ALTER COLUMN recurring SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  DROP CONSTRAINT IF EXISTS bills_status_check,
  ADD CONSTRAINT bills_status_check CHECK (status IN ('pending', 'paid', 'overdue'));

CREATE OR REPLACE FUNCTION public.sync_finance_requested_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'accounts' THEN
    NEW.opening_balance := COALESCE(NEW.opening_balance, NEW.initial_balance, NEW.balance, 0);
    NEW.initial_balance := COALESCE(NEW.initial_balance, NEW.opening_balance, 0);
  ELSIF TG_TABLE_NAME = 'transactions' THEN
    NEW.to_account_id := COALESCE(NEW.to_account_id, NEW.transfer_account_id);
    NEW.transfer_account_id := COALESCE(NEW.transfer_account_id, NEW.to_account_id);
  ELSIF TG_TABLE_NAME = 'budgets' THEN
    NEW.month_key := COALESCE(NEW.month_key, NEW.year::text || '-' || lpad(NEW.month::text, 2, '0'));
    NEW.limit_amount := COALESCE(NEW.limit_amount, NEW.monthly_limit, NEW.amount, 0);
    NEW.monthly_limit := COALESCE(NEW.monthly_limit, NEW.limit_amount, NEW.amount, 0);
    NEW.amount := COALESCE(NEW.amount, NEW.limit_amount, NEW.monthly_limit, 0);
  ELSIF TG_TABLE_NAME = 'emis' THEN
    NEW.total_amount := COALESCE(NEW.total_amount, NEW.principal_amount, 0);
    NEW.principal_amount := COALESCE(NEW.principal_amount, NEW.total_amount, 0);
    NEW.tenure_months := COALESCE(NEW.tenure_months, NEW.total_months, 0);
    NEW.total_months := COALESCE(NEW.total_months, NEW.tenure_months, 0);
    NEW.monthly_amount := COALESCE(NEW.monthly_amount, NEW.emi_amount, 0);
    NEW.emi_amount := COALESCE(NEW.emi_amount, NEW.monthly_amount, 0);
    NEW.due_date := COALESCE(NEW.due_date, NEW.start_date);
  ELSIF TG_TABLE_NAME = 'emi_payments' THEN
    NEW.status := CASE
      WHEN NEW.is_paid THEN 'paid'
      WHEN NEW.due_date < CURRENT_DATE THEN 'overdue'
      ELSE COALESCE(NEW.status, 'pending')
    END;
  ELSIF TG_TABLE_NAME = 'bills' THEN
    NEW.recurring := COALESCE(NEW.recurring, NEW.is_recurring, false);
    NEW.is_recurring := COALESCE(NEW.is_recurring, NEW.recurring, false);
    NEW.status := CASE
      WHEN COALESCE(NEW.is_paid, false) THEN 'paid'
      WHEN NEW.due_date < CURRENT_DATE THEN 'overdue'
      ELSE COALESCE(NEW.status, 'pending')
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_sync_requested_columns ON public.accounts;
CREATE TRIGGER accounts_sync_requested_columns
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_requested_columns();

DROP TRIGGER IF EXISTS transactions_sync_requested_columns ON public.transactions;
CREATE TRIGGER transactions_sync_requested_columns
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_requested_columns();

DROP TRIGGER IF EXISTS budgets_sync_requested_columns ON public.budgets;
CREATE TRIGGER budgets_sync_requested_columns
  BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_requested_columns();

DROP TRIGGER IF EXISTS emis_sync_requested_columns ON public.emis;
CREATE TRIGGER emis_sync_requested_columns
  BEFORE INSERT OR UPDATE ON public.emis
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_requested_columns();

DROP TRIGGER IF EXISTS emi_payments_sync_requested_columns ON public.emi_payments;
CREATE TRIGGER emi_payments_sync_requested_columns
  BEFORE INSERT OR UPDATE ON public.emi_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_requested_columns();

DROP TRIGGER IF EXISTS bills_sync_requested_columns ON public.bills;
CREATE TRIGGER bills_sync_requested_columns
  BEFORE INSERT OR UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_requested_columns();

CREATE OR REPLACE FUNCTION public.refresh_emi_remaining_balance(target_emi_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.emis emi
  SET
    remaining_balance = GREATEST(
      COALESCE(emi.total_amount, emi.principal_amount, 0) -
      COALESCE((
        SELECT SUM(payment.principal_component + payment.interest_component)
        FROM public.emi_payments payment
        WHERE payment.emi_id = emi.id AND payment.is_paid = true
      ), 0),
      0
    ),
    next_due_date = (
      SELECT MIN(payment.due_date)
      FROM public.emi_payments payment
      WHERE payment.emi_id = emi.id AND payment.is_paid = false
    )
  WHERE emi.id = target_emi_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_emi_from_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_emi_remaining_balance(OLD.emi_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_emi_remaining_balance(NEW.emi_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS emi_payments_refresh_emi_balance ON public.emi_payments;
CREATE TRIGGER emi_payments_refresh_emi_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.emi_payments
  FOR EACH ROW EXECUTE FUNCTION public.refresh_emi_from_payment_change();

CREATE OR REPLACE FUNCTION public.refresh_goal_progress(target_goal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.savings_goals goal
  SET progress_amount = COALESCE((
    SELECT SUM(contribution.amount)
    FROM public.goal_contributions contribution
    WHERE contribution.goal_id = goal.id
  ), 0)
  WHERE goal.id = target_goal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_goal_from_contribution_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_goal_progress(OLD.goal_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_goal_progress(NEW.goal_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS goal_contributions_refresh_goal_progress ON public.goal_contributions;
CREATE TRIGGER goal_contributions_refresh_goal_progress
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_goal_from_contribution_change();

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'goal_contributions' AND policyname = 'Users can view own goal_contributions'
  ) THEN
    CREATE POLICY "Users can view own goal_contributions"
      ON public.goal_contributions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'goal_contributions' AND policyname = 'Users can insert own goal_contributions'
  ) THEN
    CREATE POLICY "Users can insert own goal_contributions"
      ON public.goal_contributions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'goal_contributions' AND policyname = 'Users can update own goal_contributions'
  ) THEN
    CREATE POLICY "Users can update own goal_contributions"
      ON public.goal_contributions FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'goal_contributions' AND policyname = 'Users can delete own goal_contributions'
  ) THEN
    CREATE POLICY "Users can delete own goal_contributions"
      ON public.goal_contributions FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS goal_contributions_goal_idx ON public.goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS goal_contributions_transaction_idx ON public.goal_contributions(transaction_id);
CREATE INDEX IF NOT EXISTS budgets_user_month_key_idx ON public.budgets(user_id, month_key);
CREATE INDEX IF NOT EXISTS emi_payments_status_due_idx ON public.emi_payments(user_id, status, due_date);

DO $$
DECLARE
  realtime_table text;
BEGIN
  FOREACH realtime_table IN ARRAY ARRAY['goal_contributions']
  LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', realtime_table);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = realtime_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', realtime_table);
    END IF;
  END LOOP;
END $$;

SELECT public.recalculate_all_account_current_balances();

