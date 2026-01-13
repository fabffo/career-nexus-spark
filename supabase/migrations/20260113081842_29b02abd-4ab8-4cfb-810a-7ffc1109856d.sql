-- Table pour stocker chaque ligne de rapprochement de façon normalisée
CREATE TABLE public.lignes_rapprochement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fichier_rapprochement_id UUID NOT NULL REFERENCES public.fichiers_rapprochement(id) ON DELETE CASCADE,
  
  -- Identifiant de la ligne
  numero_ligne VARCHAR(50) NOT NULL,
  
  -- Transaction bancaire
  transaction_date DATE NOT NULL,
  transaction_libelle TEXT NOT NULL,
  transaction_debit NUMERIC(15,2) DEFAULT 0,
  transaction_credit NUMERIC(15,2) DEFAULT 0,
  transaction_montant NUMERIC(15,2) DEFAULT 0,
  
  -- Statut du rapprochement
  statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',
  
  -- Associations (une seule ou multiple)
  facture_id UUID REFERENCES public.factures(id) ON DELETE SET NULL,
  abonnement_id UUID REFERENCES public.abonnements_partenaires(id) ON DELETE SET NULL,
  declaration_charge_id UUID REFERENCES public.declarations_charges_sociales(id) ON DELETE SET NULL,
  
  -- Pour les rapprochements multiples
  factures_ids UUID[] DEFAULT '{}',
  
  -- Partenaire détecté automatiquement
  fournisseur_detecte_id UUID,
  fournisseur_detecte_type VARCHAR(50),
  fournisseur_detecte_nom VARCHAR(255),
  score_detection INTEGER DEFAULT 0,
  
  -- Notes et métadonnées
  notes TEXT,
  numero_facture VARCHAR(100),
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_lignes_rapprochement_fichier ON public.lignes_rapprochement(fichier_rapprochement_id);
CREATE INDEX idx_lignes_rapprochement_statut ON public.lignes_rapprochement(statut);
CREATE INDEX idx_lignes_rapprochement_date ON public.lignes_rapprochement(transaction_date);
CREATE INDEX idx_lignes_rapprochement_facture ON public.lignes_rapprochement(facture_id);
CREATE INDEX idx_lignes_rapprochement_abonnement ON public.lignes_rapprochement(abonnement_id);

-- Contrainte d'unicité sur numero_ligne par fichier
CREATE UNIQUE INDEX idx_lignes_rapprochement_unique ON public.lignes_rapprochement(fichier_rapprochement_id, numero_ligne);

-- Enable RLS
ALTER TABLE public.lignes_rapprochement ENABLE ROW LEVEL SECURITY;

-- Policies (accès complet pour utilisateurs authentifiés)
CREATE POLICY "Authenticated users can view lignes_rapprochement"
  ON public.lignes_rapprochement FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lignes_rapprochement"
  ON public.lignes_rapprochement FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lignes_rapprochement"
  ON public.lignes_rapprochement FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete lignes_rapprochement"
  ON public.lignes_rapprochement FOR DELETE
  TO authenticated
  USING (true);

-- Trigger pour updated_at
CREATE TRIGGER update_lignes_rapprochement_updated_at
  BEFORE UPDATE ON public.lignes_rapprochement
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Commentaires pour documentation
COMMENT ON TABLE public.lignes_rapprochement IS 'Lignes de rapprochement bancaire normalisées';
COMMENT ON COLUMN public.lignes_rapprochement.statut IS 'EN_ATTENTE, RAPPROCHE, PARTIEL, IGNORE';
COMMENT ON COLUMN public.lignes_rapprochement.fournisseur_detecte_type IS 'client, general, services, etat, banque, prestataire, salarie';
COMMENT ON COLUMN public.lignes_rapprochement.factures_ids IS 'Liste des factures pour rapprochements multiples';