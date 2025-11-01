-- Ajouter un champ numero_ligne_rapprochement aux factures pour identifier la ligne spécifique
ALTER TABLE public.factures 
ADD COLUMN IF NOT EXISTS numero_ligne_rapprochement VARCHAR;

-- Ajouter un index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_factures_numero_ligne_rapprochement 
ON public.factures(numero_ligne_rapprochement);

-- Commentaire pour documenter le champ
COMMENT ON COLUMN public.factures.numero_ligne_rapprochement IS 'Numéro unique de la ligne de rapprochement bancaire (format: RL-YYYYMMDD-XXXXX)';