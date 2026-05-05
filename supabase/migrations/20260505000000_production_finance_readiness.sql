-- Production readiness additions for the finance tracker.
-- Keeps the existing app schema intact while adding compatibility columns,
-- account balance triggers, and realtime publication coverage.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS opening_balance numeric,
  ADD COLUMN IF NOT EXISTS current_balance numeric NOT NULL DEFAULT 0;

UPDATE public.accounts
SET opening_balance = COALESCE(opening_balance, initial_balance, balance, 0);

ALTER TABLE public.accounts
  ALTER COLUMN opening_balance SET DEFAULT 0,
  ALTER COLUMN opening_balance SET NOT NULL;

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS monthly_limit numeric;

UPDATE public.budgets
SET monthly_limit = COALESCE(monthly_limit, amount);

ALTER TABLE public.budgets
  ALTER COLUMN monthly_limit SET DEFAULT 0,
  ALTER COLUMN monthly_limit SET NOT NULL;

ALTER TABLE public.emis
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS interest numeric,
  ADD COLUMN IF NOT EXISTS tenure integer,
  ADD COLUMN IF NOT EXISTS monthly_amount numeric,
  ADD COLUMN IF NOT EXISTS due_date date;

UPDATE public.emis
SET
  total_amount = COALESCE(total_amount, principal_amount),
  interest = COALESCE(interest, interest_rate),
  tenure = COALESCE(tenure, total_months),
  monthly_amount = COALESCE(monthly_amount, emi_amount),
  due_date = COALESCE(due_date, start_date);

CREATE OR REPLACE FUNCTION public.sync_finance_compatibility_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'accounts' THEN
    NEW.opening_balance := COALESCE(NEW.opening_balance, NEW.initial_balance, NEW.balance, 0);
    NEW.initial_balance := COALESCE(NEW.initial_balance, NEW.opening_balance, 0);
  ELSIF TG_TABLE_NAME = 'budgets' THEN
    NEW.monthly_limit := COALESCE(NEW.monthly_limit, NEW.amount, 0);
    NEW.amount := COALESCE(NEW.amount, NEW.monthly_limit, 0);
  ELSIF TG_TABLE_NAME = 'emis' THEN
    NEW.total_amount := COALESCE(NEW.total_amount, NEW.principal_amount, 0);
    NEW.principal_amount := COALESCE(NEW.principal_amount, NEW.total_amount, 0);
    NEW.interest := COALESCE(NEW.interest, NEW.interest_rate, 0);
    NEW.interest_rate := COALESCE(NEW.interest_rate, NEW.interest, 0);
    NEW.tenure := COALESCE(NEW.tenure, NEW.total_months, 0);
    NEW.total_months := COALESCE(NEW.total_months, NEW.tenure, 0);
    NEW.monthly_amount := COALESCE(NEW.monthly_amount, NEW.emi_amount, 0);
    NEW.emi_amount := COALESCE(NEW.emi_amount, NEW.monthly_amount, 0);
    NEW.due_date := COALESCE(NEW.due_date, NEW.start_date);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_sync_compatibility_columns ON public.accounts;
CREATE TRIGGER accounts_sync_compatibility_columns
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_compatibility_columns();

DROP TRIGGER IF EXISTS budgets_sync_compatibility_columns ON public.budgets;
CREATE TRIGGER budgets_sync_compatibility_columns
  BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_compatibility_columns();

DROP TRIGGER IF EXISTS emis_sync_compatibility_columns ON public.emis;
CREATE TRIGGER emis_sync_compatibility_columns
  BEFORE INSERT OR UPDATE ON public.emis
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_compatibility_columns();

CREATE OR REPLACE FUNCTION public.recalculate_account_current_balance(target_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.accounts account
  SET current_balance =
    COALESCE(account.initial_balance, account.opening_balance, account.balance, 0)
    + COALESCE((
      SELECT SUM(
        CASE
          WHEN tx.account_id = account.id AND tx.type = 'credit' THEN tx.amount
          WHEN tx.account_id = account.id AND tx.type = 'debit' THEN -tx.amount
          WHEN tx.account_id = account.id AND tx.type = 'transfer' THEN -tx.amount
          WHEN tx.to_account_id = account.id AND tx.type = 'transfer' THEN tx.amount
          ELSE 0
        END
      )
      FROM public.transactions tx
      WHERE tx.account_id = account.id OR tx.to_account_id = account.id
    ), 0)
  WHERE account.id = target_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_account_current_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_record record;
BEGIN
  FOR account_record IN SELECT id FROM public.accounts LOOP
    PERFORM public.recalculate_account_current_balance(account_record.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_account_current_balance_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.recalculate_account_current_balance(OLD.account_id);
    IF OLD.to_account_id IS NOT NULL THEN
      PERFORM public.recalculate_account_current_balance(OLD.to_account_id);
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.recalculate_account_current_balance(NEW.account_id);
    IF NEW.to_account_id IS NOT NULL THEN
      PERFORM public.recalculate_account_current_balance(NEW.to_account_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS transactions_refresh_account_current_balance ON public.transactions;
CREATE TRIGGER transactions_refresh_account_current_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_account_current_balance_from_transaction();

DROP TRIGGER IF EXISTS accounts_refresh_current_balance_on_opening_change ON public.accounts;

CREATE OR REPLACE FUNCTION public.refresh_account_current_balance_from_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_account_current_balance(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_refresh_current_balance_on_opening_change
  AFTER INSERT OR UPDATE OF initial_balance, opening_balance, balance ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.refresh_account_current_balance_from_account();

SELECT public.recalculate_all_account_current_balances();

DO $$
DECLARE
  realtime_table text;
BEGIN
  FOREACH realtime_table IN ARRAY ARRAY[
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'emis',
    'emi_payments',
    'savings_goals',
    'bills',
    'bill_payment_history'
  ]
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
