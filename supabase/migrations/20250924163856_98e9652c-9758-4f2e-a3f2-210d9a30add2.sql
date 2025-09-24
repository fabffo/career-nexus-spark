-- Create table for storing matching analyses
CREATE TABLE public.matchings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidat_id UUID REFERENCES public.candidats(id) ON DELETE CASCADE,
  poste_id UUID REFERENCES public.postes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  match BOOLEAN NOT NULL,
  analysis TEXT NOT NULL,
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  cv_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.matchings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view matchings" 
ON public.matchings 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create matchings" 
ON public.matchings 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Create index for better performance
CREATE INDEX idx_matchings_candidat ON public.matchings(candidat_id);
CREATE INDEX idx_matchings_poste ON public.matchings(poste_id);
CREATE INDEX idx_matchings_created_at ON public.matchings(created_at DESC);