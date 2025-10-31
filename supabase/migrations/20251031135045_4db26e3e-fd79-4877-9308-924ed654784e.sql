-- Table des CRA (Compte Rendu d'Activité)
CREATE TABLE IF NOT EXISTS public.cra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  prestataire_id UUID NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  statut VARCHAR(50) NOT NULL DEFAULT 'BROUILLON' CHECK (statut IN ('BROUILLON', 'SOUMIS', 'VALIDE', 'REJETE')),
  jours_travailles INTEGER DEFAULT 0,
  jours_conges INTEGER DEFAULT 0,
  jours_absence INTEGER DEFAULT 0,
  total_heures NUMERIC(10, 2) DEFAULT 0,
  ca_mensuel NUMERIC(10, 2) DEFAULT 0,
  commentaires TEXT,
  valide_par UUID REFERENCES auth.users(id),
  date_soumission TIMESTAMP WITH TIME ZONE,
  date_validation TIMESTAMP WITH TIME ZONE,
  commentaires_validation TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(mission_id, annee, mois)
);

-- Table des détails journaliers des CRA
CREATE TABLE IF NOT EXISTS public.cra_jours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cra_id UUID NOT NULL REFERENCES public.cra(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type_jour VARCHAR(50) NOT NULL DEFAULT 'TRAVAILLE' CHECK (type_jour IN (
    'TRAVAILLE', 'CONGE_PAYE', 'RTT', 'ABSENCE', 
    'ARRET_MALADIE', 'FORMATION', 'FERIE', 'WEEKEND'
  )),
  heures NUMERIC(4, 2) DEFAULT 8.0,
  commentaire TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(cra_id, date)
);

-- Table des jours fériés (personnalisable)
CREATE TABLE IF NOT EXISTS public.jours_feries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  annee INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table historique des TMJ (pour suivre les changements de tarifs)
CREATE TABLE IF NOT EXISTS public.historique_tjm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  tjm_ancien NUMERIC(10, 2),
  tjm_nouveau NUMERIC(10, 2) NOT NULL,
  date_changement DATE NOT NULL DEFAULT CURRENT_DATE,
  motif TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger pour mettre à jour updated_at sur CRA
CREATE OR REPLACE FUNCTION update_cra_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cra_updated_at
BEFORE UPDATE ON public.cra
FOR EACH ROW
EXECUTE FUNCTION update_cra_updated_at();

-- Trigger pour mettre à jour updated_at sur CRA jours
CREATE TRIGGER trigger_update_cra_jours_updated_at
BEFORE UPDATE ON public.cra_jours
FOR EACH ROW
EXECUTE FUNCTION update_cra_updated_at();

-- Fonction pour calculer automatiquement les totaux d'un CRA
CREATE OR REPLACE FUNCTION calculer_totaux_cra()
RETURNS TRIGGER AS $$
DECLARE
  v_cra_id UUID;
  v_total_travailles INTEGER;
  v_total_conges INTEGER;
  v_total_absence INTEGER;
  v_total_heures NUMERIC;
BEGIN
  -- Récupérer le cra_id
  IF TG_OP = 'DELETE' THEN
    v_cra_id := OLD.cra_id;
  ELSE
    v_cra_id := NEW.cra_id;
  END IF;
  
  -- Calculer les totaux
  SELECT 
    COUNT(*) FILTER (WHERE type_jour = 'TRAVAILLE'),
    COUNT(*) FILTER (WHERE type_jour IN ('CONGE_PAYE', 'RTT')),
    COUNT(*) FILTER (WHERE type_jour IN ('ABSENCE', 'ARRET_MALADIE')),
    COALESCE(SUM(heures) FILTER (WHERE type_jour = 'TRAVAILLE'), 0)
  INTO 
    v_total_travailles,
    v_total_conges,
    v_total_absence,
    v_total_heures
  FROM public.cra_jours
  WHERE cra_id = v_cra_id;
  
  -- Mettre à jour le CRA
  UPDATE public.cra
  SET 
    jours_travailles = v_total_travailles,
    jours_conges = v_total_conges,
    jours_absence = v_total_absence,
    total_heures = v_total_heures,
    ca_mensuel = v_total_travailles * (
      SELECT COALESCE(m.tjm, 0) 
      FROM public.missions m 
      WHERE m.id = (SELECT mission_id FROM public.cra WHERE id = v_cra_id)
    )
  WHERE id = v_cra_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculer_totaux_cra
AFTER INSERT OR UPDATE OR DELETE ON public.cra_jours
FOR EACH ROW
EXECUTE FUNCTION calculer_totaux_cra();

-- Insérer quelques jours fériés français pour 2025
INSERT INTO public.jours_feries (date, libelle, annee) VALUES
  ('2025-01-01', 'Jour de l''An', 2025),
  ('2025-04-21', 'Lundi de Pâques', 2025),
  ('2025-05-01', 'Fête du Travail', 2025),
  ('2025-05-08', 'Victoire 1945', 2025),
  ('2025-05-29', 'Ascension', 2025),
  ('2025-06-09', 'Lundi de Pentecôte', 2025),
  ('2025-07-14', 'Fête Nationale', 2025),
  ('2025-08-15', 'Assomption', 2025),
  ('2025-11-01', 'Toussaint', 2025),
  ('2025-11-11', 'Armistice 1918', 2025),
  ('2025-12-25', 'Noël', 2025)
ON CONFLICT (date) DO NOTHING;

-- RLS Policies pour CRA
ALTER TABLE public.cra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cra_jours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jours_feries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historique_tjm ENABLE ROW LEVEL SECURITY;

-- Policies pour CRA
CREATE POLICY "Authorized roles can view CRA"
  ON public.cra FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Prestataires can view their own CRA"
  ON public.cra FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.prestataires p
      WHERE p.id = cra.prestataire_id 
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Authorized roles can manage CRA"
  ON public.cra FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Policies pour CRA jours
CREATE POLICY "Authorized roles can view CRA jours"
  ON public.cra_jours FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cra c
      WHERE c.id = cra_jours.cra_id
      AND (
        user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role])
        OR EXISTS (
          SELECT 1 FROM public.prestataires p
          WHERE p.id = c.prestataire_id AND p.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Authorized roles can manage CRA jours"
  ON public.cra_jours FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Policies pour jours fériés (lecture pour tous)
CREATE POLICY "Everyone can view jours feries"
  ON public.jours_feries FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage jours feries"
  ON public.jours_feries FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Policies pour historique TMJ
CREATE POLICY "Authorized roles can view historique TMJ"
  ON public.historique_tjm FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage historique TMJ"
  ON public.historique_tjm FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));