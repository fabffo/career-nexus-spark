-- Create banks table
CREATE TABLE public.banques (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raison_sociale TEXT NOT NULL,
  secteur_activite TEXT DEFAULT 'Banque',
  adresse TEXT,
  email TEXT,
  telephone TEXT,
  site_web TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banques ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view all banques" 
ON public.banques 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can create banques" 
ON public.banques 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update banques" 
ON public.banques 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Users can delete banques" 
ON public.banques 
FOR DELETE 
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_banques_updated_at
BEFORE UPDATE ON public.banques
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();