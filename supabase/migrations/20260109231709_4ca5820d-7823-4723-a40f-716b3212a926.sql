-- Créer la table charges_mensuelles
CREATE TABLE public.charges_mensuelles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periode_mois INTEGER NOT NULL,
  periode_annee INTEGER NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_libelle TEXT NOT NULL,
  transaction_montant NUMERIC NOT NULL DEFAULT 0,
  total_ht NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  total_tva NUMERIC DEFAULT 0,
  numero_facture TEXT,
  facture_id UUID REFERENCES public.factures(id),
  type TEXT NOT NULL DEFAULT 'Achat',
  activite TEXT NOT NULL DEFAULT 'Généraux',
  fichier_rapprochement_id UUID REFERENCES public.fichiers_rapprochement(id),
  rapprochement_id UUID REFERENCES public.rapprochements_bancaires(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour recherche par période
CREATE INDEX idx_charges_mensuelles_periode ON public.charges_mensuelles(periode_annee, periode_mois);

-- Index pour recherche par fichier rapprochement
CREATE INDEX idx_charges_mensuelles_fichier ON public.charges_mensuelles(fichier_rapprochement_id);

-- Enable Row Level Security
ALTER TABLE public.charges_mensuelles ENABLE ROW LEVEL SECURITY;

-- Policies pour consultation
CREATE POLICY "Authorized roles can view charges_mensuelles" 
ON public.charges_mensuelles 
FOR SELECT 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

-- Policies pour création
CREATE POLICY "Authorized roles can create charges_mensuelles" 
ON public.charges_mensuelles 
FOR INSERT 
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Policies pour modification
CREATE POLICY "Authorized roles can update charges_mensuelles" 
ON public.charges_mensuelles 
FOR UPDATE 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Policies pour suppression
CREATE POLICY "Authorized roles can delete charges_mensuelles" 
ON public.charges_mensuelles 
FOR DELETE 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_charges_mensuelles_updated_at
BEFORE UPDATE ON public.charges_mensuelles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();