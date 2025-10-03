-- Créer la table param_type_prestation
CREATE TABLE IF NOT EXISTS public.param_type_prestation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  libelle VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insérer les valeurs par défaut
INSERT INTO public.param_type_prestation (code, libelle, ordre) VALUES
  ('RECRUTEMENT', 'Recrutement', 1),
  ('FORMATION', 'Formation', 2)
ON CONFLICT (code) DO NOTHING;

-- Activer RLS
ALTER TABLE public.param_type_prestation ENABLE ROW LEVEL SECURITY;

-- Politique pour que tout le monde puisse voir les types de prestation actifs
CREATE POLICY "Tous peuvent voir les types de prestation actifs"
  ON public.param_type_prestation
  FOR SELECT
  USING (is_active = true OR user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Politique pour que seuls les admins puissent gérer les types de prestation
CREATE POLICY "Admins peuvent gérer les types de prestation"
  ON public.param_type_prestation
  FOR ALL
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- Trigger pour la validation des types de prestation dans la table postes
CREATE OR REPLACE FUNCTION public.validate_type_prestation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type_prestation IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM param_type_prestation 
    WHERE code = NEW.type_prestation 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Type de prestation invalide: %', NEW.type_prestation;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_type_prestation_trigger
  BEFORE INSERT OR UPDATE ON public.postes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_type_prestation();