-- Add new columns to habits table for period-based tracking
ALTER TABLE public.habits 
ADD COLUMN start_date date,
ADD COLUMN end_date date,
ADD COLUMN skip_weekends boolean DEFAULT false,
ADD COLUMN skip_holidays boolean DEFAULT false,
ADD COLUMN custom_skip_days text[] DEFAULT '{}',
ADD COLUMN goal text;

-- Update target_count to be nullable (will be calculated from period)
ALTER TABLE public.habits 
ALTER COLUMN target_count DROP DEFAULT;