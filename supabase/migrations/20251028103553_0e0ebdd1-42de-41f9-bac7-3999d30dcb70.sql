-- Créer la table des règles de rapprochement
CREATE TABLE IF NOT EXISTS public.regles_rapprochement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom VARCHAR NOT NULL,
  type_regle VARCHAR NOT NULL CHECK (type_regle IN ('MONTANT', 'DATE', 'LIBELLE', 'TYPE_TRANSACTION', 'PARTENAIRE', 'PERSONNALISEE')),
  description TEXT,
  condition_json JSONB NOT NULL,
  score_attribue INTEGER NOT NULL DEFAULT 0 CHECK (score_attribue >= 0 AND score_attribue <= 100),
  priorite INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_regles_rapprochement_actif ON public.regles_rapprochement(actif);
CREATE INDEX idx_regles_rapprochement_type ON public.regles_rapprochement(type_regle);
CREATE INDEX idx_regles_rapprochement_priorite ON public.regles_rapprochement(priorite DESC);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_regles_rapprochement_updated_at
  BEFORE UPDATE ON public.regles_rapprochement
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.regles_rapprochement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized roles can view regles_rapprochement"
  ON public.regles_rapprochement
  FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage regles_rapprochement"
  ON public.regles_rapprochement
  FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Insérer des règles par défaut
INSERT INTO public.regles_rapprochement (nom, type_regle, description, condition_json, score_attribue, priorite, actif) VALUES
  ('Montant exact', 'MONTANT', 'Le montant de la transaction doit correspondre exactement au montant de la facture', '{"tolerance": 0.01}'::jsonb, 40, 1, true),
  ('Type transaction - Crédit vers Vente', 'TYPE_TRANSACTION', 'Les crédits sont associés aux factures de vente', '{"transaction_type": "credit", "facture_type": "VENTES"}'::jsonb, 10, 2, true),
  ('Type transaction - Débit vers Achat', 'TYPE_TRANSACTION', 'Les débits sont associés aux factures d''achat', '{"transaction_type": "debit", "facture_type": "ACHATS"}'::jsonb, 10, 2, true),
  ('Date - Même jour', 'DATE', 'Transaction et facture du même jour', '{"diff_jours": 0}'::jsonb, 30, 3, true),
  ('Date - Moins de 3 jours', 'DATE', 'Écart de moins de 3 jours', '{"diff_jours_max": 3}'::jsonb, 25, 4, true),
  ('Date - Moins d''une semaine', 'DATE', 'Écart de moins de 7 jours', '{"diff_jours_max": 7}'::jsonb, 20, 5, true),
  ('Date - Moins d''un mois', 'DATE', 'Écart de moins de 30 jours', '{"diff_jours_max": 30}'::jsonb, 10, 6, true),
  ('Libellé - Nom partenaire', 'PARTENAIRE', 'Le nom du partenaire apparaît dans le libellé', '{"min_length": 3}'::jsonb, 15, 7, true),
  ('Libellé - Numéro facture', 'LIBELLE', 'Le numéro de facture apparaît dans le libellé', '{}'::jsonb, 10, 8, true),
  ('Libellé - Mots-clés', 'LIBELLE', 'Présence de mots-clés (facture, paiement, virement)', '{"keywords": ["facture", "fac", "fact", "invoice", "paiement", "virement", "payment"]}'::jsonb, 5, 9, true);