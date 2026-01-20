-- Table entête pour les résumés mensuels de TVA
CREATE TABLE public.tva_mensuel_entete (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  tva_collectee NUMERIC(15,2) NOT NULL DEFAULT 0,
  tva_deductible NUMERIC(15,2) NOT NULL DEFAULT 0,
  tva_a_payer NUMERIC(15,2) GENERATED ALWAYS AS (tva_collectee - tva_deductible) STORED,
  statut VARCHAR(20) NOT NULL DEFAULT 'BROUILLON' CHECK (statut IN ('BROUILLON', 'VALIDE')),
  date_validation TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(annee, mois)
);

-- Table détail pour les lignes de TVA
CREATE TABLE public.tva_mensuel_detail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entete_id UUID NOT NULL REFERENCES public.tva_mensuel_entete(id) ON DELETE CASCADE,
  ligne_rapprochement_id UUID REFERENCES public.lignes_rapprochement(id),
  date_operation DATE NOT NULL,
  libelle TEXT,
  numero_facture VARCHAR(100),
  type_operation VARCHAR(50) NOT NULL CHECK (type_operation IN ('VENTES', 'ACHAT_GENERAUX', 'ACHAT_SERVICES', 'ABONNEMENT', 'CHARGES_SOCIALES')),
  type_partenaire VARCHAR(50),
  partenaire_nom TEXT,
  montant_ht NUMERIC(15,2) NOT NULL DEFAULT 0,
  tva_deductible NUMERIC(15,2) NOT NULL DEFAULT 0,
  tva_collectee NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_tva_mensuel_detail_entete ON public.tva_mensuel_detail(entete_id);
CREATE INDEX idx_tva_mensuel_detail_date ON public.tva_mensuel_detail(date_operation);
CREATE INDEX idx_tva_mensuel_entete_periode ON public.tva_mensuel_entete(annee, mois);

-- Enable RLS
ALTER TABLE public.tva_mensuel_entete ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tva_mensuel_detail ENABLE ROW LEVEL SECURITY;

-- Policies pour les utilisateurs authentifiés
CREATE POLICY "Authenticated users can view tva_mensuel_entete"
  ON public.tva_mensuel_entete FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tva_mensuel_entete"
  ON public.tva_mensuel_entete FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tva_mensuel_entete"
  ON public.tva_mensuel_entete FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete tva_mensuel_entete"
  ON public.tva_mensuel_entete FOR DELETE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can view tva_mensuel_detail"
  ON public.tva_mensuel_detail FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tva_mensuel_detail"
  ON public.tva_mensuel_detail FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tva_mensuel_detail"
  ON public.tva_mensuel_detail FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete tva_mensuel_detail"
  ON public.tva_mensuel_detail FOR DELETE
  TO authenticated USING (true);

-- Trigger pour updated_at
CREATE TRIGGER update_tva_mensuel_entete_updated_at
  BEFORE UPDATE ON public.tva_mensuel_entete
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();