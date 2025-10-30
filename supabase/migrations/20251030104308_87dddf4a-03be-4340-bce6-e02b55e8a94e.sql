-- Table de liaison candidats-postes avec étapes de recrutement
CREATE TABLE IF NOT EXISTS public.candidats_postes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidat_id UUID NOT NULL,
  poste_id UUID NOT NULL,
  etape_recrutement VARCHAR NOT NULL DEFAULT 'CV_RECU',
  date_candidature TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  salaire_propose NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(candidat_id, poste_id)
);

-- Trigger pour updated_at
CREATE TRIGGER update_candidats_postes_updated_at
  BEFORE UPDATE ON public.candidats_postes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies
ALTER TABLE public.candidats_postes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized roles can view candidats_postes"
  ON public.candidats_postes FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can create candidats_postes"
  ON public.candidats_postes FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can update candidats_postes"
  ON public.candidats_postes FOR UPDATE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can delete candidats_postes"
  ON public.candidats_postes FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role]));

-- Table des étapes de recrutement paramétrables
CREATE TABLE IF NOT EXISTS public.param_etapes_recrutement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  libelle VARCHAR NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  couleur VARCHAR NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger pour updated_at
CREATE TRIGGER update_param_etapes_recrutement_updated_at
  BEFORE UPDATE ON public.param_etapes_recrutement
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies pour param_etapes_recrutement
ALTER TABLE public.param_etapes_recrutement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active etapes_recrutement"
  ON public.param_etapes_recrutement FOR SELECT
  USING (is_active = true OR user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

CREATE POLICY "Admins can manage etapes_recrutement"
  ON public.param_etapes_recrutement FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Insérer les étapes de recrutement par défaut
INSERT INTO public.param_etapes_recrutement (code, libelle, ordre, couleur) VALUES
  ('CV_RECU', 'CV reçu', 1, '#9CA3AF'),
  ('PRE_SELECTION', 'Pré-sélection', 2, '#3B82F6'),
  ('ENTRETIEN_RH', 'Entretien RH', 3, '#8B5CF6'),
  ('ENTRETIEN_TECHNIQUE', 'Entretien technique', 4, '#EC4899'),
  ('ENTRETIEN_CLIENT', 'Entretien client', 5, '#F59E0B'),
  ('PROPOSITION', 'Proposition faite', 6, '#10B981'),
  ('ACCEPTE', 'Accepté', 7, '#059669'),
  ('REFUSE', 'Refusé', 8, '#EF4444'),
  ('ABANDONNE', 'Abandonné', 9, '#6B7280')
ON CONFLICT (code) DO NOTHING;