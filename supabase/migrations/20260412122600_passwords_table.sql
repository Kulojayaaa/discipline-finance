CREATE TABLE public.passwords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  username TEXT,
  password_value TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.passwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own passwords" ON public.passwords
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
