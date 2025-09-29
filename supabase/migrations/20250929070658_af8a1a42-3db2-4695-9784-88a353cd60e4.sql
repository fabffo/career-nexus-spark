-- Create salaries table with same structure as candidats
CREATE TABLE public.salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom VARCHAR NOT NULL,
  prenom VARCHAR NOT NULL,
  email VARCHAR,
  telephone VARCHAR,
  detail_cv TEXT,
  cv_url TEXT,
  recommandation_url TEXT,
  user_id UUID,
  invitation_token TEXT,
  invitation_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view salaries" 
ON public.salaries 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert salaries" 
ON public.salaries 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update salaries" 
ON public.salaries 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete salaries" 
ON public.salaries 
FOR DELETE 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_salaries_updated_at 
BEFORE UPDATE ON public.salaries 
FOR EACH ROW 
EXECUTE FUNCTION public.update_updated_at_column();