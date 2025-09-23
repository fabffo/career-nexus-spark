-- Add Teams integration fields to rdvs table
ALTER TABLE public.rdvs 
ADD COLUMN IF NOT EXISTS teams_link TEXT,
ADD COLUMN IF NOT EXISTS teams_meeting_id TEXT;