-- Ajouter la colonne salarie_id dans la table prestataires
ALTER TABLE public.prestataires
ADD COLUMN IF NOT EXISTS salarie_id UUID REFERENCES public.salaries(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_prestataires_salarie_id ON public.prestataires(salarie_id);

-- Mettre à jour le type_prestataire pour accepter SALARIE
COMMENT ON COLUMN public.prestataires.type_prestataire IS 'Type de prestataire: INDEPENDANT, SOCIETE ou SALARIE';