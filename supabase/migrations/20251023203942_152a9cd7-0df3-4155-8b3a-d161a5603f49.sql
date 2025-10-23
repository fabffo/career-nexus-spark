-- Créer la table abonnements_consommations
CREATE TABLE IF NOT EXISTS public.abonnements_consommations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  abonnement_id UUID NOT NULL REFERENCES public.abonnements_partenaires(id) ON DELETE CASCADE,
  rapprochement_id UUID REFERENCES public.rapprochements_bancaires(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL,
  date_consommation DATE NOT NULL,
  libelle TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_abonnements_consommations_abonnement ON public.abonnements_consommations(abonnement_id);
CREATE INDEX idx_abonnements_consommations_rapprochement ON public.abonnements_consommations(rapprochement_id);
CREATE INDEX idx_abonnements_consommations_date ON public.abonnements_consommations(date_consommation);

-- Trigger pour updated_at
CREATE TRIGGER update_abonnements_consommations_updated_at
  BEFORE UPDATE ON public.abonnements_consommations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE public.abonnements_consommations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized roles can view abonnements_consommations"
  ON public.abonnements_consommations
  FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create abonnements_consommations"
  ON public.abonnements_consommations
  FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update abonnements_consommations"
  ON public.abonnements_consommations
  FOR UPDATE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete abonnements_consommations"
  ON public.abonnements_consommations
  FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));