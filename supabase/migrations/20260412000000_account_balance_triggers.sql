
-- Function to update account balance atomically
CREATE OR REPLACE FUNCTION public.handle_transaction_change()
RETURNS TRIGGER AS $$
DECLARE
    v_account_id UUID;
    v_amount DECIMAL;
    v_type TEXT;
BEGIN
    -- Determine which account and amount to use
    IF (TG_OP = 'INSERT') THEN
        v_account_id := NEW.account_id;
        v_amount := NEW.amount;
        v_type := NEW.type;
        
        -- Update the main account balance
        IF v_type = 'credit' THEN
            UPDATE public.accounts SET balance = balance + v_amount WHERE id = v_account_id;
        ELSIF v_type = 'debit' OR v_type = 'transfer' THEN
            UPDATE public.accounts SET balance = balance - v_amount WHERE id = v_account_id;
        END IF;

        -- If it's a transfer, update the target account too
        IF v_type = 'transfer' AND NEW.to_account_id IS NOT NULL THEN
            UPDATE public.accounts SET balance = balance + v_amount WHERE id = NEW.to_account_id;
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        v_account_id := OLD.account_id;
        v_amount := OLD.amount;
        v_type := OLD.type;

        -- Reverse the transaction on the main account
        IF v_type = 'credit' THEN
            UPDATE public.accounts SET balance = balance - v_amount WHERE id = v_account_id;
        ELSIF v_type = 'debit' OR v_type = 'transfer' THEN
            UPDATE public.accounts SET balance = balance + v_amount WHERE id = v_account_id;
        END IF;

        -- If it's a transfer, reverse it on the target account too
        IF v_type = 'transfer' AND OLD.to_account_id IS NOT NULL THEN
            UPDATE public.accounts SET balance = balance - v_amount WHERE id = OLD.to_account_id;
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- This is more complex, we reverse OLD and apply NEW
        -- Reverse OLD
        IF OLD.type = 'credit' THEN
            UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'debit' OR OLD.type = 'transfer' THEN
            UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
        END IF;
        
        IF OLD.type = 'transfer' AND OLD.to_account_id IS NOT NULL THEN
            UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.to_account_id;
        END IF;

        -- Apply NEW
        IF NEW.type = 'credit' THEN
            UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF NEW.type = 'debit' OR NEW.type = 'transfer' THEN
            UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
        END IF;

        IF NEW.type = 'transfer' AND NEW.to_account_id IS NOT NULL THEN
            UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.to_account_id;
        END IF;
    END IF;

    RETURN NULL; -- result is ignored since this is an AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_transaction_change ON public.transactions;
CREATE TRIGGER on_transaction_change
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_change();
