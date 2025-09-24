-- Create table for storing complete analysis data
CREATE TABLE public.analyse_poste_candidat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidat_id UUID REFERENCES public.candidats(id),
  poste_id UUID REFERENCES public.postes(id),
  detail_cv TEXT NOT NULL,
  detail_poste JSONB NOT NULL,
  score INTEGER,
  match BOOLEAN,
  analysis TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.analyse_poste_candidat ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view analyses" 
ON public.analyse_poste_candidat 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create analyses" 
ON public.analyse_poste_candidat 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update their analyses" 
ON public.analyse_poste_candidat 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Create index for better performance
CREATE INDEX idx_analyse_poste_candidat_candidat ON public.analyse_poste_candidat(candidat_id);
CREATE INDEX idx_analyse_poste_candidat_poste ON public.analyse_poste_candidat(poste_id);
CREATE INDEX idx_analyse_poste_candidat_created_at ON public.analyse_poste_candidat(created_at DESC);