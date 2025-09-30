-- Ajouter le type de prestation aux postes
ALTER TABLE public.postes 
ADD COLUMN type_prestation VARCHAR DEFAULT 'RECRUTEMENT' CHECK (type_prestation IN ('RECRUTEMENT', 'FORMATION'));

-- Mettre à jour les postes existants
UPDATE public.postes SET type_prestation = 'RECRUTEMENT' WHERE type_prestation IS NULL;