-- Create param_activite table for activity types
CREATE TABLE public.param_activite (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  libelle VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.param_activite ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins peuvent gérer les activités" 
ON public.param_activite 
FOR ALL 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

CREATE POLICY "Tous peuvent voir les activités actives" 
ON public.param_activite 
FOR SELECT 
USING ((is_active = true) OR user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Insert initial values
INSERT INTO public.param_activite (code, libelle, ordre) VALUES
  ('OUTILS_NUMERIQUES', 'Outils numériques', 1),
  ('FRAIS_EXCEPTIONNELLES', 'Frais exceptionnelles', 2),
  ('COMPTABILITE', 'Comptabilité', 3),
  ('BANQUE', 'Banque', 4),
  ('IMPOT_SOCIETE', 'Impôt Société', 5),
  ('TVA', 'TVA', 6),
  ('TELECOM', 'Télécom', 7),
  ('VEHICULE', 'Véhicule', 8),
  ('LOGEMENT', 'Logement', 9),
  ('ASSURANCES_PRO', 'Assurances professionnelles', 10),
  ('JOBBOARD', 'Jobboard', 11),
  ('VEILLE_PRO', 'Veille professionnelle', 12),
  ('CERTIFICATION', 'Certification', 13),
  ('TRANSPORTS', 'Transports & déplacements', 14),
  ('INFOGREFFE', 'Infogreffe', 15),
  ('RESTAURANT', 'Restaurant', 16),
  ('HOTEL', 'Hôtel', 17);