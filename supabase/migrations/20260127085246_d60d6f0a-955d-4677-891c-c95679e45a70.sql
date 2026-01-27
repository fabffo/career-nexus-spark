-- Créer la table param_type_prestataire
CREATE TABLE IF NOT EXISTS public.param_type_prestataire (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  libelle VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.param_type_prestataire ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Admins peuvent gérer les types de prestataire"
  ON public.param_type_prestataire
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "Tous peuvent voir les types de prestataire actifs"
  ON public.param_type_prestataire
  FOR SELECT
  USING (is_active = true);

-- Insérer les valeurs par défaut
INSERT INTO public.param_type_prestataire (code, libelle, ordre) VALUES
  ('INDEPENDANT', 'Indépendant', 1),
  ('SALARIE', 'Salarié', 2),
  ('SOCIETE', 'Société', 3),
  ('APPORTEUR_AFFAIRES', 'Apporteur d''affaires', 4);

-- Créer un trigger de validation pour prestataires
CREATE OR REPLACE FUNCTION public.validate_prestataire_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type_prestataire IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM param_type_prestataire 
    WHERE code = NEW.type_prestataire 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Type de prestataire invalide: %', NEW.type_prestataire;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_prestataire_type_trigger
  BEFORE INSERT OR UPDATE ON public.prestataires
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_prestataire_type();