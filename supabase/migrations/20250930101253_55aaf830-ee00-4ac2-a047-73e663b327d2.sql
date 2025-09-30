-- Create table for internal company information
CREATE TABLE public.societe_interne (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raison_sociale TEXT NOT NULL,
  adresse TEXT,
  telephone VARCHAR(20),
  email VARCHAR(255),
  capital_social NUMERIC(10, 2),
  siren VARCHAR(20),
  tva VARCHAR(20),
  reference_bancaire TEXT,
  etablissement_bancaire TEXT,
  iban VARCHAR(34),
  bic VARCHAR(11),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.societe_interne ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access only
CREATE POLICY "Only admins can view societe_interne"
ON public.societe_interne
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'ADMIN'::user_role
));

CREATE POLICY "Only admins can create societe_interne"
ON public.societe_interne
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'ADMIN'::user_role
));

CREATE POLICY "Only admins can update societe_interne"
ON public.societe_interne
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'ADMIN'::user_role
));

CREATE POLICY "Only admins can delete societe_interne"
ON public.societe_interne
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'ADMIN'::user_role
));

-- Create trigger for updating timestamps
CREATE TRIGGER update_societe_interne_updated_at
BEFORE UPDATE ON public.societe_interne
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();