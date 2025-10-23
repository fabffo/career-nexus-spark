-- Créer la table des types d'impôts
CREATE TABLE IF NOT EXISTS public.types_impots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  libelle VARCHAR NOT NULL,
  description TEXT,
  periodicite VARCHAR NOT NULL CHECK (periodicite IN ('MENSUEL', 'TRIMESTRIEL', 'ANNUEL', 'PONCTUEL')),
  couleur VARCHAR NOT NULL DEFAULT '#3B82F6',
  icone VARCHAR,
  ordre INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Créer la table des échéances fiscales
CREATE TABLE IF NOT EXISTS public.echeances_fiscales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_impot_id UUID NOT NULL REFERENCES public.types_impots(id) ON DELETE CASCADE,
  libelle VARCHAR NOT NULL,
  description TEXT,
  date_echeance DATE NOT NULL,
  montant_estime NUMERIC(15,2),
  montant_paye NUMERIC(15,2),
  statut VARCHAR NOT NULL DEFAULT 'A_PAYER' CHECK (statut IN ('A_PAYER', 'PAYE', 'RETARD', 'ANNULE')),
  date_paiement DATE,
  justificatif_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Créer la table des rappels automatiques
CREATE TABLE IF NOT EXISTS public.rappels_fiscaux (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  echeance_id UUID NOT NULL REFERENCES public.echeances_fiscales(id) ON DELETE CASCADE,
  jours_avant INTEGER NOT NULL CHECK (jours_avant > 0),
  date_rappel DATE NOT NULL,
  envoye BOOLEAN DEFAULT false,
  date_envoi TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insérer les types d'impôts par défaut
INSERT INTO public.types_impots (code, libelle, description, periodicite, couleur, icone, ordre) VALUES
('IS', 'Impôt sur les Sociétés', 'Impôt calculé sur les bénéfices de la société', 'ANNUEL', '#DC2626', 'building-2', 1),
('TVA', 'TVA', 'Taxe sur la Valeur Ajoutée collectée et déductible', 'MENSUEL', '#2563EB', 'receipt', 2),
('COTISATIONS', 'Cotisations Sociales', 'Cotisations sociales du président de SASU', 'TRIMESTRIEL', '#7C3AED', 'user-check', 3),
('DIVIDENDES', 'Dividendes (PFU)', 'Prélèvement Forfaitaire Unique sur dividendes', 'PONCTUEL', '#059669', 'coins', 4),
('CFE', 'CFE', 'Cotisation Foncière des Entreprises', 'ANNUEL', '#D97706', 'store', 5),
('TVS', 'TVS', 'Taxe sur les Véhicules de Société', 'ANNUEL', '#0891B2', 'car', 6),
('TAXE_APPRENTISSAGE', 'Taxe d''Apprentissage', 'Contribution à la formation professionnelle', 'ANNUEL', '#EC4899', 'graduation-cap', 7)
ON CONFLICT (code) DO NOTHING;

-- Activer RLS sur toutes les tables
ALTER TABLE public.types_impots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echeances_fiscales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rappels_fiscaux ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour types_impots
CREATE POLICY "Tous peuvent voir les types d'impôts actifs"
ON public.types_impots FOR SELECT
USING (is_active = true OR user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

CREATE POLICY "Admins peuvent gérer les types d'impôts"
ON public.types_impots FOR ALL
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Politiques RLS pour echeances_fiscales
CREATE POLICY "Authorized roles can view echeances_fiscales"
ON public.echeances_fiscales FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage echeances_fiscales"
ON public.echeances_fiscales FOR ALL
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Politiques RLS pour rappels_fiscaux
CREATE POLICY "Authorized roles can view rappels_fiscaux"
ON public.rappels_fiscaux FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage rappels_fiscaux"
ON public.rappels_fiscaux FOR ALL
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Créer un trigger pour mettre à jour updated_at
CREATE TRIGGER update_types_impots_updated_at
BEFORE UPDATE ON public.types_impots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_echeances_fiscales_updated_at
BEFORE UPDATE ON public.echeances_fiscales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour créer automatiquement les rappels
CREATE OR REPLACE FUNCTION public.create_rappels_for_echeance()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer rappels à J-15, J-7, J-1
  INSERT INTO public.rappels_fiscaux (echeance_id, jours_avant, date_rappel)
  VALUES 
    (NEW.id, 15, NEW.date_echeance - INTERVAL '15 days'),
    (NEW.id, 7, NEW.date_echeance - INTERVAL '7 days'),
    (NEW.id, 1, NEW.date_echeance - INTERVAL '1 day');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER create_rappels_on_echeance_insert
AFTER INSERT ON public.echeances_fiscales
FOR EACH ROW
EXECUTE FUNCTION public.create_rappels_for_echeance();