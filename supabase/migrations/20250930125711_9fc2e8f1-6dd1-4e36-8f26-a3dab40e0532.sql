-- Création des tables pour la gestion des factures

-- Table des factures (en-tête)
CREATE TABLE public.factures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_facture VARCHAR(255) NOT NULL UNIQUE,
  type_facture VARCHAR(10) NOT NULL CHECK (type_facture IN ('VENTES', 'ACHATS')),
  date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance DATE NOT NULL,
  
  -- Coordonnées émetteur
  emetteur_type VARCHAR(50) NOT NULL,
  emetteur_id UUID,
  emetteur_nom VARCHAR(255) NOT NULL,
  emetteur_adresse TEXT,
  emetteur_telephone VARCHAR(50),
  emetteur_email VARCHAR(255),
  
  -- Coordonnées destinataire
  destinataire_type VARCHAR(50) NOT NULL,
  destinataire_id UUID,
  destinataire_nom VARCHAR(255) NOT NULL,
  destinataire_adresse TEXT,
  destinataire_telephone VARCHAR(50),
  destinataire_email VARCHAR(255),
  
  -- Totaux
  total_ht NUMERIC(10, 2) DEFAULT 0,
  total_tva NUMERIC(10, 2) DEFAULT 0,
  total_ttc NUMERIC(10, 2) DEFAULT 0,
  
  -- Informations de paiement
  informations_paiement TEXT,
  reference_societe VARCHAR(255),
  statut VARCHAR(20) DEFAULT 'BROUILLON' CHECK (statut IN ('BROUILLON', 'VALIDEE', 'PAYEE', 'ANNULEE')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Table des lignes de factures
CREATE TABLE public.facture_lignes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  ordre INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  prix_ht NUMERIC(10, 2) NOT NULL,
  taux_tva NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
  montant_tva NUMERIC(10, 2) GENERATED ALWAYS AS (prix_ht * taux_tva / 100) STORED,
  prix_ttc NUMERIC(10, 2) GENERATED ALWAYS AS (prix_ht * (1 + taux_tva / 100)) STORED,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_factures_type ON public.factures(type_facture);
CREATE INDEX idx_factures_statut ON public.factures(statut);
CREATE INDEX idx_factures_date_emission ON public.factures(date_emission);
CREATE INDEX idx_facture_lignes_facture_id ON public.facture_lignes(facture_id);

-- Trigger pour mettre à jour les totaux de la facture
CREATE OR REPLACE FUNCTION public.update_facture_totaux()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.factures
  SET 
    total_ht = (SELECT COALESCE(SUM(prix_ht), 0) FROM public.facture_lignes WHERE facture_id = COALESCE(NEW.facture_id, OLD.facture_id)),
    total_tva = (SELECT COALESCE(SUM(montant_tva), 0) FROM public.facture_lignes WHERE facture_id = COALESCE(NEW.facture_id, OLD.facture_id)),
    total_ttc = (SELECT COALESCE(SUM(prix_ttc), 0) FROM public.facture_lignes WHERE facture_id = COALESCE(NEW.facture_id, OLD.facture_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.facture_id, OLD.facture_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_facture_totaux
AFTER INSERT OR UPDATE OR DELETE ON public.facture_lignes
FOR EACH ROW
EXECUTE FUNCTION public.update_facture_totaux();

-- Fonction pour générer un numéro de facture
CREATE OR REPLACE FUNCTION public.generate_numero_facture(p_type VARCHAR)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_count INTEGER;
  v_numero TEXT;
BEGIN
  -- Déterminer le préfixe selon le type
  IF p_type = 'VENTES' THEN
    v_prefix := 'FAC-V';
  ELSE
    v_prefix := 'FAC-A';
  END IF;
  
  -- Obtenir l'année courante
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Compter les factures de ce type pour cette année
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.factures
  WHERE type_facture = p_type
    AND EXTRACT(YEAR FROM date_emission) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Générer le numéro
  v_numero := v_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
  
  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_factures_updated_at
BEFORE UPDATE ON public.factures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_facture_lignes_updated_at
BEFORE UPDATE ON public.facture_lignes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facture_lignes ENABLE ROW LEVEL SECURITY;

-- Politiques pour les factures
CREATE POLICY "Authorized roles can view factures"
ON public.factures FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can create factures"
ON public.factures FOR INSERT
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update factures"
ON public.factures FOR UPDATE
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Only admins can delete factures"
ON public.factures FOR DELETE
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Politiques pour les lignes de factures
CREATE POLICY "Authorized roles can view facture_lignes"
ON public.facture_lignes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.factures
  WHERE factures.id = facture_lignes.facture_id
  AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
));

CREATE POLICY "Authorized roles can manage facture_lignes"
ON public.facture_lignes FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.factures
  WHERE factures.id = facture_lignes.facture_id
  AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.factures
  WHERE factures.id = facture_lignes.facture_id
  AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role])
));