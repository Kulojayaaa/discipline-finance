
-- Add progress column to goals
ALTER TABLE public.goals ADD COLUMN progress integer DEFAULT 0;

-- Create goal_updates table for daily progress notes
CREATE TABLE public.goal_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  update_date date NOT NULL DEFAULT CURRENT_DATE,
  note text NOT NULL,
  progress_value integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal_updates" ON public.goal_updates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goal_updates" ON public.goal_updates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goal_updates" ON public.goal_updates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goal_updates" ON public.goal_updates FOR DELETE USING (auth.uid() = user_id);
