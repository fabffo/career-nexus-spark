-- Supprimer l'ancienne contrainte
ALTER TABLE public.prestataires DROP CONSTRAINT IF EXISTS prestataires_type_prestataire_check;

-- Recréer avec toutes les valeurs autorisées (correspondant à param_type_prestataire)
ALTER TABLE public.prestataires ADD CONSTRAINT prestataires_type_prestataire_check 
  CHECK (type_prestataire::text = ANY (ARRAY['INDEPENDANT', 'SOCIETE', 'SALARIE', 'APPORTEUR_AFFAIRES']::text[]));