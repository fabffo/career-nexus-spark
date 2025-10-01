-- Créer la table param_type_mission
CREATE TABLE public.param_type_mission (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insérer les types de mission par défaut
INSERT INTO public.param_type_mission (code, libelle, ordre) VALUES
  ('FORFAIT', 'Forfait', 1),
  ('TJM', 'TJM (Taux Journalier Moyen)', 2),
  ('RECRUTEMENT', 'Recrutement', 3);

-- Créer la table param_type_intervenant
CREATE TABLE public.param_type_intervenant (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insérer les types d'intervenant par défaut
INSERT INTO public.param_type_intervenant (code, libelle, ordre) VALUES
  ('PRESTATAIRE', 'Prestataire', 1),
  ('SALARIE', 'Salarié', 2);

-- Activer RLS
ALTER TABLE public.param_type_mission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.param_type_intervenant ENABLE ROW LEVEL SECURITY;

-- Policies pour param_type_mission
CREATE POLICY "Tous peuvent voir les types de mission actifs"
  ON public.param_type_mission
  FOR SELECT
  USING (is_active = true OR user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

CREATE POLICY "Admins peuvent gérer les types de mission"
  ON public.param_type_mission
  FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Policies pour param_type_intervenant  
CREATE POLICY "Tous peuvent voir les types d'intervenant actifs"
  ON public.param_type_intervenant
  FOR SELECT
  USING (is_active = true OR user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

CREATE POLICY "Admins peuvent gérer les types d'intervenant"
  ON public.param_type_intervenant
  FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Créer les triggers pour updated_at
CREATE TRIGGER update_param_type_mission_updated_at
  BEFORE UPDATE ON public.param_type_mission
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_param_type_intervenant_updated_at
  BEFORE UPDATE ON public.param_type_intervenant
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();