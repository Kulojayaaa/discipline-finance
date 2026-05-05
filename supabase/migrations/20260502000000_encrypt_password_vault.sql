CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.passwords
ADD COLUMN IF NOT EXISTS password_ciphertext BYTEA,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.passwords
ALTER COLUMN password_value DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.list_passwords(vault_key TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  username TEXT,
  password_value TEXT,
  url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.title,
    p.username,
    CASE
      WHEN p.password_ciphertext IS NOT NULL THEN extensions.pgp_sym_decrypt(p.password_ciphertext, vault_key)
      ELSE p.password_value
    END AS password_value,
    p.url,
    p.notes,
    p.created_at,
    p.updated_at
  FROM public.passwords p
  WHERE p.user_id = auth.uid()
  ORDER BY p.title;
$$;

CREATE OR REPLACE FUNCTION public.save_password(
  vault_key TEXT,
  entry_title TEXT,
  entry_username TEXT,
  entry_password TEXT,
  entry_url TEXT,
  entry_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.passwords (
    user_id,
    title,
    username,
    password_value,
    password_ciphertext,
    url,
    notes
  )
  VALUES (
    auth.uid(),
    entry_title,
    NULLIF(entry_username, ''),
    '[encrypted]',
    extensions.pgp_sym_encrypt(entry_password, vault_key),
    NULLIF(entry_url, ''),
    NULLIF(entry_notes, '')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.migrate_legacy_passwords(vault_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  migrated_count INTEGER;
BEGIN
  UPDATE public.passwords
  SET
    password_ciphertext = extensions.pgp_sym_encrypt(password_value, vault_key),
    password_value = '[encrypted]',
    updated_at = now()
  WHERE user_id = auth.uid()
    AND password_ciphertext IS NULL
    AND password_value IS NOT NULL
    AND password_value <> '[encrypted]';

  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RETURN migrated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_password(entry_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY INVOKER
SET search_path = public
AS $$
  DELETE FROM public.passwords
  WHERE id = entry_id
    AND user_id = auth.uid();
$$;
