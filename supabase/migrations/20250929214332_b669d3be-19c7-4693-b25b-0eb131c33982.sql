-- Créer la table des taux de TVA
CREATE TABLE public.tva (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  taux DECIMAL(5, 2) NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insérer les taux de TVA principaux
INSERT INTO public.tva (taux, libelle, is_default) VALUES
  (20.00, 'TVA normale - 20%', true),
  (10.00, 'TVA intermédiaire - 10%', false),
  (5.50, 'TVA réduite - 5,5%', false),
  (2.10, 'TVA super réduite - 2,1%', false),
  (0.00, 'Exonéré de TVA', false);

-- Créer le type enum pour le type de mission
CREATE TYPE type_mission AS ENUM ('FORFAIT', 'TJM', 'RECRUTEMENT');

-- Créer le type enum pour le type d'intervenant
CREATE TYPE type_intervenant AS ENUM ('PRESTATAIRE', 'SALARIE');

-- Créer la table missions
CREATE TABLE public.missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Lien avec poste et contrat
  poste_id UUID REFERENCES public.postes(id) ON DELETE SET NULL,
  contrat_id UUID REFERENCES public.contrats(id) ON DELETE SET NULL,
  
  -- Informations de base reprises du poste
  titre VARCHAR(255) NOT NULL,
  description TEXT,
  localisation TEXT,
  competences TEXT[],
  
  -- Type de mission et intervenant
  type_mission type_mission NOT NULL,
  type_intervenant type_intervenant NOT NULL,
  
  -- Intervenants (un seul peut être renseigné)
  prestataire_id UUID REFERENCES public.prestataires(id) ON DELETE SET NULL,
  salarie_id UUID REFERENCES public.salaries(id) ON DELETE SET NULL,
  
  -- Informations financières
  prix_ht DECIMAL(10, 2),
  tva_id UUID REFERENCES public.tva(id) ON DELETE SET NULL,
  taux_tva DECIMAL(5, 2) DEFAULT 20.00,
  prix_ttc DECIMAL(10, 2),
  
  -- Spécifique TJM
  tjm DECIMAL(10, 2),
  nombre_jours INTEGER,
  
  -- Dates
  date_debut DATE,
  date_fin DATE,
  
  -- Statut
  statut VARCHAR(50) DEFAULT 'EN_COURS',
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_missions_updated_at
BEFORE UPDATE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tva_updated_at
BEFORE UPDATE ON public.tva
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS pour la table tva
ALTER TABLE public.tva ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view TVA rates"
ON public.tva
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage TVA rates"
ON public.tva
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- RLS pour la table missions
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized roles can view missions"
ON public.missions
FOR SELECT
USING (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

CREATE POLICY "Authorized roles can create missions"
ON public.missions
FOR INSERT
WITH CHECK (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

CREATE POLICY "Authorized roles can update missions"
ON public.missions
FOR UPDATE
USING (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

CREATE POLICY "Admins can delete missions"
ON public.missions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'::user_role
  )
);

-- Contrainte pour vérifier qu'un seul type d'intervenant est renseigné
ALTER TABLE public.missions ADD CONSTRAINT check_intervenant 
CHECK (
  (type_intervenant = 'PRESTATAIRE' AND prestataire_id IS NOT NULL AND salarie_id IS NULL) OR
  (type_intervenant = 'SALARIE' AND salarie_id IS NOT NULL AND prestataire_id IS NULL)
);

-- Fonction pour calculer automatiquement le prix TTC
CREATE OR REPLACE FUNCTION public.calculate_prix_ttc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prix_ht IS NOT NULL AND NEW.taux_tva IS NOT NULL THEN
    NEW.prix_ttc := NEW.prix_ht * (1 + NEW.taux_tva / 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer le prix TTC automatiquement
CREATE TRIGGER calculate_missions_prix_ttc
BEFORE INSERT OR UPDATE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_prix_ttc();