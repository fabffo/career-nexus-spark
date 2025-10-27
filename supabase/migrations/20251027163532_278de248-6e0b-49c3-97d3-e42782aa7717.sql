-- Create table for social charges declarations (recurring/automatic)
CREATE TABLE public.declarations_charges_sociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR NOT NULL,
  organisme VARCHAR NOT NULL, -- URSSAF, Retraite, Mutuelle, etc.
  type_charge VARCHAR NOT NULL, -- SALAIRE, CHARGES_SOCIALES, RETRAITE, MUTUELLE
  periodicite VARCHAR NOT NULL DEFAULT 'MENSUEL', -- MENSUEL, TRIMESTRIEL, ANNUEL
  montant_estime NUMERIC,
  jour_echeance INTEGER, -- Jour du mois pour l'échéance
  actif BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.declarations_charges_sociales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authorized roles can view declarations_charges_sociales"
  ON public.declarations_charges_sociales
  FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create declarations_charges_sociales"
  ON public.declarations_charges_sociales
  FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update declarations_charges_sociales"
  ON public.declarations_charges_sociales
  FOR UPDATE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete declarations_charges_sociales"
  ON public.declarations_charges_sociales
  FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Create trigger for updated_at
CREATE TRIGGER update_declarations_charges_sociales_updated_at
  BEFORE UPDATE ON public.declarations_charges_sociales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add index
CREATE INDEX idx_declarations_charges_sociales_actif ON public.declarations_charges_sociales(actif);
CREATE INDEX idx_declarations_charges_sociales_organisme ON public.declarations_charges_sociales(organisme);