-- Créer la table des abonnements partenaires
CREATE TABLE IF NOT EXISTS public.abonnements_partenaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR NOT NULL,
  nature VARCHAR NOT NULL CHECK (nature IN ('RELEVE_BANQUE', 'ASSURANCE', 'LOA_VOITURE', 'LOYER', 'AUTRE')),
  montant_mensuel NUMERIC,
  jour_prelevement INTEGER CHECK (jour_prelevement >= 1 AND jour_prelevement <= 31),
  actif BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Créer la table des paiements d'abonnements
CREATE TABLE IF NOT EXISTS public.paiements_abonnements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abonnement_id UUID NOT NULL REFERENCES public.abonnements_partenaires(id) ON DELETE CASCADE,
  rapprochement_id UUID REFERENCES public.rapprochements_bancaires(id) ON DELETE SET NULL,
  date_paiement DATE NOT NULL,
  montant NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_abonnements_partenaires_nature ON public.abonnements_partenaires(nature);
CREATE INDEX IF NOT EXISTS idx_abonnements_partenaires_actif ON public.abonnements_partenaires(actif);
CREATE INDEX IF NOT EXISTS idx_paiements_abonnements_abonnement ON public.paiements_abonnements(abonnement_id);
CREATE INDEX IF NOT EXISTS idx_paiements_abonnements_date ON public.paiements_abonnements(date_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_abonnements_rapprochement ON public.paiements_abonnements(rapprochement_id);

-- Ajouter la colonne abonnement_id dans rapprochements_bancaires
ALTER TABLE public.rapprochements_bancaires 
ADD COLUMN IF NOT EXISTS abonnement_id UUID REFERENCES public.abonnements_partenaires(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rapprochements_abonnement ON public.rapprochements_bancaires(abonnement_id);

-- Activer RLS
ALTER TABLE public.abonnements_partenaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements_abonnements ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour abonnements_partenaires
CREATE POLICY "Authorized roles can view abonnements_partenaires"
  ON public.abonnements_partenaires
  FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create abonnements_partenaires"
  ON public.abonnements_partenaires
  FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update abonnements_partenaires"
  ON public.abonnements_partenaires
  FOR UPDATE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete abonnements_partenaires"
  ON public.abonnements_partenaires
  FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Politiques RLS pour paiements_abonnements
CREATE POLICY "Authorized roles can view paiements_abonnements"
  ON public.paiements_abonnements
  FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create paiements_abonnements"
  ON public.paiements_abonnements
  FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update paiements_abonnements"
  ON public.paiements_abonnements
  FOR UPDATE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete paiements_abonnements"
  ON public.paiements_abonnements
  FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Trigger pour updated_at
CREATE TRIGGER update_abonnements_partenaires_updated_at
  BEFORE UPDATE ON public.abonnements_partenaires
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paiements_abonnements_updated_at
  BEFORE UPDATE ON public.paiements_abonnements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();